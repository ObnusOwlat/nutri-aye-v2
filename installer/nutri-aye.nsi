; Nutri Aye installer for Windows (built by installer/build.sh with makensis).
; Per user, without administrator: the program goes to %LOCALAPPDATA%\Programs\Nutri Aye
; and the data to %LOCALAPPDATA%\NutriAye (launcher.js), which reinstalling,
; updating or uninstalling never deletes.
Unicode true
!include "MUI2.nsh"

!define APP "Nutri Aye"
!define EXE "nutri-aye-server.exe"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\NutriAye"

Name "${APP}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\${APP}"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "${APP} ${VERSION}"

!define MUI_ICON "${STAGE}\nutri-aye.ico"
!define MUI_UNICON "${STAGE}\nutri-aye.ico"
!define MUI_WELCOMEPAGE_TEXT "Se va a instalar ${APP} en esta computadora.$\r$\n$\r$\nLa app se abre en el navegador y arranca sola al prender Windows. Los datos quedan en esta computadora y no se borran al actualizar.$\r$\n$\r$\nSi ya estaba instalada, se actualiza conservando los pacientes."
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Abrir ${APP}"
!define MUI_FINISHPAGE_RUN_FUNCTION OpenApp
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"

; The running server keeps its files open: stop it before copying or removing
!macro StopServer
    nsExec::Exec 'taskkill /F /IM ${EXE}'
    Pop $0
    Sleep 1000
!macroend

Section "Nutri Aye"
    SetShellVarContext current
    !insertmacro StopServer
    ; An update replaces the program entirely (old files out), never the data
    RMDir /r "$INSTDIR\backend"
    RMDir /r "$INSTDIR\frontend"
    SetOutPath "$INSTDIR"
    File /r "${STAGE}\app\*.*"
    File "${STAGE}\nutri-aye.ico"

    ; Started minimized: the window closes by itself once the browser opens
    CreateShortCut "$DESKTOP\${APP}.lnk" "$INSTDIR\${EXE}" '"$INSTDIR\launcher.js"' "$INSTDIR\nutri-aye.ico" 0 SW_SHOWMINIMIZED
    CreateDirectory "$SMPROGRAMS\${APP}"
    CreateShortCut "$SMPROGRAMS\${APP}\${APP}.lnk" "$INSTDIR\${EXE}" '"$INSTDIR\launcher.js"' "$INSTDIR\nutri-aye.ico" 0 SW_SHOWMINIMIZED
    CreateShortCut "$SMPROGRAMS\${APP}\Desinstalar ${APP}.lnk" "$INSTDIR\Desinstalar.exe"
    CreateShortCut "$SMSTARTUP\${APP}.lnk" "$INSTDIR\${EXE}" '"$INSTDIR\launcher.js" --background' "$INSTDIR\nutri-aye.ico" 0 SW_SHOWMINIMIZED

    WriteUninstaller "$INSTDIR\Desinstalar.exe"
    WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP}"
    WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
    WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${APP}"
    WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\nutri-aye.ico"
    WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
    WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
    WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
SectionEnd

Function OpenApp
    Exec '"$INSTDIR\${EXE}" "$INSTDIR\launcher.js"'
FunctionEnd

Section "Uninstall"
    SetShellVarContext current
    !insertmacro StopServer
    Delete "$DESKTOP\${APP}.lnk"
    Delete "$SMSTARTUP\${APP}.lnk"
    RMDir /r "$SMPROGRAMS\${APP}"
    RMDir /r "$INSTDIR"
    DeleteRegKey HKCU "${UNINST_KEY}"
    MessageBox MB_OK|MB_ICONINFORMATION "Se desinstaló ${APP}.$\r$\n$\r$\nLos datos (pacientes, recetas, respaldos) quedaron en:$\r$\n$LOCALAPPDATA\NutriAye$\r$\n$\r$\nSi se vuelve a instalar, aparecen de nuevo."
SectionEnd
