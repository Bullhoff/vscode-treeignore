const vscode = require('vscode');

function activate(context) {
	const ignoreFileEnding = `.treeignore`;

	const handleConfigurationChange = ({ affectsConfiguration } = {}) => {
		if (typeof affectsConfiguration === 'function') {
			let hasChanged = affectsConfiguration('treeignore');
			if (!hasChanged) return;
		}
		const treeignore = vscode.workspace.getConfiguration('treeignore') || {};
		for (const key in treeignore) {
			context.globalState.update(key, treeignore[key]);
		}
	};

	handleConfigurationChange();
	if (context.globalState.get('enableEventListeners')) {
		context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(handleConfigurationChange));
	}

	async function updateExcludeSettings(obj = {}, uri, target = 'workspacefolder') {
		const config = vscode.workspace.getConfiguration('files', uri);
		const excludeSettings = config.inspect('exclude')?.workspaceFolderValue || {};
		const type = Object.prototype.toString.call(obj);
		for (key in obj) {
			let value = true;
			if (type === `[object Array]`) {
				key = obj[key];
			} else {
				value = obj[key];
			}
			if (value) excludeSettings[key] = value;
			else if (excludeSettings[key]) delete excludeSettings[key];
		}
		let ConfigurationTarget = (target === 'global') ? vscode.ConfigurationTarget.Global : (target === 'workspace') ? vscode.ConfigurationTarget.Workspace : (target === 'workspacefolder') ? vscode.ConfigurationTarget.WorkspaceFolder : true;
		ConfigurationTarget = vscode.ConfigurationTarget.WorkspaceFolder;
		await config.update('exclude', excludeSettings, ConfigurationTarget);
		await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
	}

	async function readTreeIgnore(fileUri, arr = [], relprefix = ``) {
		relprefix = relprefix.replaceAll(`\\`, `/`);
		const enableComments = context.globalState.get('enableComments');
		const enableMidRowComments = context.globalState.get('enableMidRowComments');
		if (relprefix[relprefix.length - 1] === `/`) relprefix = relprefix.substring(0, relprefix.length - 1);
		if (fileUri.scheme === 'file') {
			const data = await vscode.workspace.fs.readFile(fileUri);
			const content = Buffer.from(data).toString('utf8');
			let rows = content.split(`\n`);
			for (let i = 0; i < rows.length; i++) {
				let row = rows[i];
				if (i === 0 && row === `#off`) break;
				if (!row || row.substring(0, 1) === '#') continue;
				if (row.substring(0, 1) === '#' && enableComments) continue;
				if (enableMidRowComments) row = row.split(`#`).shift();

				row = row.trimEnd();
				if (row[0] === `"` && row[row.length - 1] === `"`) row = row.substring(1, row.length - 1);

				let str = `${relprefix}`;
				if (row[0] !== `/`) {
					if (str !== ``) str = `${str}/`;
					str = `${str}**/`;
				}
				str = `${str}${row}`;
				if (str[0] === `/`) str = str.substring(1);

				arr.push(str);
			}
		}
		return arr;
	};

	async function readFile(file) {
		let fileUrl = file?.path || file;
		let ext = fileUrl.split(`.`).pop();
		if (typeof file === `string`) file = vscode.Uri.file(file);
		try {
			let ok = await vscode.workspace.fs.stat(file);
			const data = await vscode.workspace.fs.readFile(file);
			const content = Buffer.from(data).toString('utf8');
			return (ext === 'json') ? JSON.parse(content) : content;
		} catch (err) {
			return (ext === 'json') ? {} : ``;
		}
	}

	async function handleIgnoreFiles(files, { rootdir_, op = 'init', text, workspaceFolder } = {}) {
		if (!workspaceFolder) return;
		let rootdir = workspaceFolder.uri.path;
		if (files && files.length > 0) {
			let dotTreeIgnoreStateUri = vscode.Uri.file(`${rootdir}/.vscode/treeignore.json`);
			let dotTreeIgnoreState = await readFile(dotTreeIgnoreStateUri);
			let obj1 = {};
			for (let i = 0; i < files.length; i++) {
				const fileUri = files[i];
				let relfilepath = `${fileUri.path.substring(rootdir.length)}`;
				let relpath = `${relfilepath.split(`/`).slice(0, -1).join('/')}/`;
				if (relpath.substring(0, 1) === `/`) relpath = relpath.substring(1);
				obj1[relfilepath] = [];
				if (!dotTreeIgnoreState[relfilepath]) dotTreeIgnoreState[relfilepath] = {};
				await readTreeIgnore(fileUri, obj1[relfilepath], `${relpath}`);
				obj1[relfilepath] = obj1[relfilepath].reduce((a, c) => {
					if (!dotTreeIgnoreState[relfilepath][c]) dotTreeIgnoreState[relfilepath][c] = (op !== 'delete') ? true : false;
					a[c] = (op !== 'delete') ? true : false;
					return a;
				}, {});

				for (key in dotTreeIgnoreState[relfilepath]) {
					let value = dotTreeIgnoreState[relfilepath][key];
					if (!obj1[relfilepath][key]) {
						obj1[relfilepath][key] = false;
						await delete dotTreeIgnoreState[relfilepath][key];
					}
				}
				if (op === 'delete') {
					delete dotTreeIgnoreState[relfilepath];
				}

			}
			let obj = Object.values(obj1).reduce((a, c) => {
				Object.assign(a, c);
				return a;
			}, {});
			await updateExcludeSettings(obj, workspaceFolder.uri, `workspacefolder`);
			const data = Buffer.from(JSON.stringify(dotTreeIgnoreState, null, 2));
			await vscode.workspace.fs.writeFile(dotTreeIgnoreStateUri, data);
		}
	};

	async function getTreeIgnoreFiles(op = `init`) {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		for (let i = 0; i < workspaceFolders.length; i++) {
			const workspaceFolder = workspaceFolders[i];
			const rootdir = workspaceFolder.uri.path;
			const relativePattern = new vscode.RelativePattern(workspaceFolder, `**/*${ignoreFileEnding}`);
			const res = await vscode.workspace.findFiles(relativePattern, '', 50);
			handleIgnoreFiles(res, { rootdir, op: op, text: null, workspaceFolder, });
		}
	};

	function onSaveFile(e) {
		if (!e.uri.path.endsWith(ignoreFileEnding)) return;
		let workspaceFolder = vscode.workspace.getWorkspaceFolder(e.uri);
		const rootdir = workspaceFolder.uri.path;
		handleIgnoreFiles([e.uri], { rootdir, op: 'save', text: e.getText(), workspaceFolder });
	};

	function onCreateFiles(e) {
		let arr = [];
		let index = 0;
		for (let i = 0; i < e.files.length; i++) {
			const fileUri = e.files[i];
			if (!fileUri.path.endsWith(ignoreFileEnding)) continue;
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
			if (arr[index]?.rootdir && arr[index].rootdir !== workspaceFolder.uri.path) index++;
			if (!arr[index]) arr[index] = { arr: [], rootdir: arr[index].rootdir, workspaceFolder };
			arr[index].arr.push(fileUri);
		}
		for (let i = 0; i < arr.length; i++) {
			handleIgnoreFiles(arr[i].arr, { rootdir: arr[i].rootdir, workspaceFolder: arr[i].workspaceFolder, op: 'create', });
		}
	};

	function onDeleteFiles(e) {
		let arr = [];
		let index = 0;
		for (let i = 0; i < e.files.length; i++) {
			const fileUri = e.files[i];
			if (!fileUri.path.endsWith(ignoreFileEnding)) continue;
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
			if (arr[index]?.rootdir && arr[index].rootdir !== workspaceFolder.uri.path) index++;
			if (!arr[index]) arr[index] = { arr: [], rootdir: arr[index].rootdir, workspaceFolder, };
			arr[index].arr.push(fileUri);
		}
		for (let i = 0; i < arr.length; i++) {
			handleIgnoreFiles(arr[i].arr, { rootdir: arr[i].rootdir, workspaceFolder: arr[i].workspaceFolder, op: 'delete', });
		}
	};

	function onRenameFiles(e) {
		let arr = [];
		let index = 0;
		let op = 'init';
		for (let i = 0; i < e.files.length; i++) {
			let fileUri = e.files[i].newUri;
			if (fileUri.path.endsWith(`${ignoreFileEnding}`)) {
				op = `init`;
				const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
				if (arr[index]?.rootdir && arr[index].rootdir !== workspaceFolder.uri.path) index++;
				if (!arr[index]) arr[index] = { arr: [], rootdir: arr[index].rootdir, workspaceFolder, };
				arr[index].arr.push(fileUri);
			} else if (e.files[i].oldUri.path.endsWith(`${ignoreFileEnding}`)) {
				fileUri = e.files[i].oldUri;
				op = `delete`;
				const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
				if (arr[index]?.rootdir && arr[index].rootdir !== workspaceFolder.uri.path) index++;
				if (!arr[index]) arr[index] = { arr: [], rootdir: arr[index].rootdir, workspaceFolder, };
				arr[index].arr.push(fileUri);
			}
		}
		for (let i = 0; i < arr.length; i++) {
			handleIgnoreFiles(arr[i].arr, { rootdir: arr[i].rootdir, workspaceFolder: arr[i].workspaceFolder, op: op, });
		}
	};

	if (context.globalState.get('enableEventListeners')) {
		context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(onSaveFile));
		context.subscriptions.push(vscode.workspace.onDidCreateFiles(onCreateFiles));
		context.subscriptions.push(vscode.workspace.onDidDeleteFiles(onDeleteFiles));
		context.subscriptions.push(vscode.workspace.onDidRenameFiles(onRenameFiles));
	}

	context.subscriptions.push(vscode.commands.registerCommand('treeignore.updateTreeignore', () => { getTreeIgnoreFiles(); }));
	context.subscriptions.push(vscode.commands.registerCommand('treeignore.enable', () => { getTreeIgnoreFiles(); }));
	context.subscriptions.push(vscode.commands.registerCommand('treeignore.disable', () => { getTreeIgnoreFiles('delete'); }));

	getTreeIgnoreFiles();
}

function deactivate() {

}

module.exports = {
	activate,
	deactivate
};

