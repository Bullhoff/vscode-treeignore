# treeignore

## Features

Exclude patterns from the Explorer/filetree panel.

The effect is similar to having `explorer.excludeGitIgnore` enabled, but only affecting the Explorer/filetree panel. 

Rules are applied to files.exclude in the workspaceFolder settings (.vscode/settings.json in whichever folder/folders the vscode instance is open in)

Disable a .treeignore file by adding `#off` as the first row. 



### Example
<u>these treeignores</u>\
├── .treeignore\
│&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `mås1.txt`\
│&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `/mås3.*`\
│&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `dir1/.treeignore`\
└── dir1\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── .treeignore\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`mås2.txt`

<u>turns this</u>\
├── .treeignore\
├── mås1.txt\
├── mås2.txt\
├── mås3.txt\
└── dir1\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── .treeignore\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── mås1.txt\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── mås2.txt\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── mås3.txt

<u>into this</u>\
├── <span style="color:gray;">.vscode/settings.json</span>\
│&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <sup>`{"files.exclude":{ "**/mås1.txt":true, "**/dir1/.treeignore":true, "mås3.*":true, "dir1/**/mås2.txt":true }}`</sup>\
├── .treeignore\
├── mås2.txt\
└── dir1\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── mås3.txt



## Extension Settings

* `treeignore.enableEventListeners`: Enable/disable event listeners (onDidChangeConfiguration, onDidSaveTextDocument, onCreateFiles, onDeleteFiles, onRenameFiles). If disabled, use treeignore.updateTreeignore to read any changes in the .treeignore files.
* `treeignore.enableComments`: Enable/disable `#comment`.
* `treeignore.enableMidRowComments`: Enable/disable `mås.txt #comment`.

## Commands

* `treeignore.updateTreeignore`: Find and parse .treeignore files.
* `treeignore.enable`: Enable .treeignore files for folders open in the vscode instance.
* `treeignore.disable`: Disable .treeignore files for folders open in the vscode instance.

## Known Issues

* files.exclude doesnt support the prefix ! (negate previous pattern). 

## Release Notes
### 1.0.0

Initial release of treeignore

