!macro customInstall
  CreateDirectory "$SMPROGRAMS\TruckTap Docs"
  CreateShortcut "$SMPROGRAMS\TruckTap Docs\TruckTap User Guide.lnk" "$INSTDIR\TruckTap-User-Guide.pdf"
  CreateShortcut "$SMPROGRAMS\TruckTap Docs\TruckTap README.lnk" "$INSTDIR\TruckTap-README.txt"
  CreateShortcut "$SMPROGRAMS\TruckTap Docs\TruckTap Terms of Service.lnk" "$INSTDIR\TRUCKTAP-TERMS.txt"
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\TruckTap Docs\TruckTap User Guide.lnk"
  Delete "$SMPROGRAMS\TruckTap Docs\TruckTap README.lnk"
  Delete "$SMPROGRAMS\TruckTap Docs\TruckTap Terms of Service.lnk"
  RMDir "$SMPROGRAMS\TruckTap Docs"
!macroend
