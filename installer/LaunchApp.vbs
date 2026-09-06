' Starts the LED Asset Manager server (using the bundled portable Node
' runtime, not a system-wide Node install) with no visible console window,
' then opens the default browser once the server has had a moment to start.
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
strAppDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

Set objEnv = objShell.Environment("PROCESS")
objEnv("DATA_DIR") = objShell.ExpandEnvironmentStrings("%PROGRAMDATA%") & "\OVRLedAssetManagement"
objEnv("PORT") = "4000"
objEnv("NODE_ENV") = "production"

objShell.CurrentDirectory = strAppDir & "\server"
objShell.Run """" & strAppDir & "\node\node.exe"" ""src\index.js""", 0, False

WScript.Sleep 1500
objShell.Run "http://localhost:4000/", 1, False
