; Motion Studio Toolkit - Windows installer (Inno Setup 6). Built by .github/workflows/release.yml:
;   ISCC /DAppVersion=1.2.0 installer\windows\MotionStudioToolkit.iss
; Installs the signed extension for the current user (no admin rights) and enables CEP debug mode.
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{6F3C2E7A-4B1D-4E8C-9A62-5D7B0C1E9F34}
AppName=Motion Studio Toolkit
AppVersion={#AppVersion}
AppPublisher=Motion Studio
DefaultDirName={userappdata}\Adobe\CEP\extensions\com.thiago.motionstudio
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\..\dist\out
OutputBaseFilename=MotionStudioToolkit-{#AppVersion}-Windows
SetupIconFile=..\..\icons\app.ico
UninstallDisplayIcon={app}\icons\panel_dark.png
UninstallDisplayName=Motion Studio Toolkit
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "pt"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[InstallDelete]
; remove the previous version completely (a stale file would break the signature)
Type: filesandordirs; Name: "{app}"

[Files]
Source: "..\..\dist\extension\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Registry]
Root: HKCU; Subkey: "Software\Adobe\CSXS.11"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"
Root: HKCU; Subkey: "Software\Adobe\CSXS.12"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"
Root: HKCU; Subkey: "Software\Adobe\CSXS.13"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"

[Messages]
pt.FinishedLabel=O Motion Studio Toolkit foi instalado. Feche o After Effects por completo, abra de novo e use Janela > Extensões > Motion Studio Toolkit.
en.FinishedLabel=Motion Studio Toolkit is installed. Quit After Effects completely, open it again and use Window > Extensions > Motion Studio Toolkit.
