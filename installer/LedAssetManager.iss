; Inno Setup script for LED Asset Manager.
; Chosen over NSIS/WiX per the plan: script-based, handles a Node-runtime-
; plus-app bundle well, and doesn't require WiX's MSI/XML verbosity for
; this scope. Compile with: ISCC.exe LedAssetManager.iss
; (from a "stage" folder produced by build.ps1 - see installer/README.md)

#define MyAppName "LED Asset Manager"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "World Table Tennis"

[Setup]
AppId={{2F7B9C2E-7A3D-4E8B-9C1A-LEDASSETMGR1}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=output
OutputBaseFilename=LedAssetManager-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
UninstallDisplayIcon={app}\LaunchApp.vbs
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; "stage" is produced by build.ps1: server code (+ production
; node_modules), the Vite client build, and a portable Node runtime.
Source: "stage\server\*"; DestDir: "{app}\server"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "stage\client\*"; DestDir: "{app}\client"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "stage\node\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "LaunchApp.vbs"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
; %ProgramData% (not per-user %LOCALAPPDATA%) per the plan §K rationale:
; different Windows logins may operate the same shared event-prep laptop,
; and config/DB/logs should be machine-wide, not fragmented per user.
; users-modify so a non-admin operator account can still read/write it.
Name: "{commonappdata}\OVRLedAssetManagement"; Permissions: users-modify
Name: "{commonappdata}\OVRLedAssetManagement\logs"; Permissions: users-modify
Name: "{commonappdata}\OVRLedAssetManagement\downloads"; Permissions: users-modify
Name: "{commonappdata}\OVRLedAssetManagement\renamed"; Permissions: users-modify
Name: "{commonappdata}\OVRLedAssetManagement\defaults"; Permissions: users-modify

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "wscript.exe"; Parameters: """{app}\LaunchApp.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\node\node.exe"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "wscript.exe"; Parameters: """{app}\LaunchApp.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\node\node.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Run]
Filename: "wscript.exe"; Parameters: """{app}\LaunchApp.vbs"""; Description: "Launch {#MyAppName}"; Flags: postinstall nowait skipifsilent

; Deliberately no [UninstallDelete] entry for {commonappdata}\OVRLedAssetManagement -
; uninstalling removes the application but preserves configuration, the
; SQLite database, and logs, per the plan's "preserve user data on
; uninstall" requirement. A user wanting a full wipe can delete that
; folder manually.
