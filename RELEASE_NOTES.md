Jelly+ 0.1.2.0 für Jellyfin 12.2 – Browser-Einbindung und saisonale Erweiterungen.

- Browser-Einbindung wartet auf den API-Client und reagiert auf nachgeladene Ansichten. Der Script-Verweis enthält die Plugin-Version, damit alte Browser-Caches nicht die vorherige Erweiterung behalten.
- ElegantFin-seasonal.js wird in Version v0.1.13 für Desktop und Mobil eingebunden. Das vorhandene Theme liefert die CSS-Effekte; es wird kein zusätzliches Effekt-CSS geladen.
- Saisonale Empfehlungen stehen direkt vor den kürzlich hinzugefügten Medien und werden auch bei verspätetem Aufbau der Startseite richtig einsortiert.
- 21 .NET-Tests und 15 Oberflächentests erfolgreich; Profileinstellungen, Medienmenü und Zeilenposition zusätzlich im echten Browser mit Desktop-, klassischer Desktop-, Mobil- und TV-Layout geprüft. Das angegebene Seasonal-Script wurde dabei in unveränderter Form ausgeführt.

Nach dem Update den Jellyfin-Container neu starten, die Browserseite neu laden und die LG-App vollständig schließen und erneut öffnen.

Installationsanleitung und Manifest stehen im Repository. Die Browser-Erweiterung setzt die vom Jellyfin-Server ausgelieferte Weboberfläche voraus. Ein Test auf physischer LG-Hardware steht noch aus. Details und Prüfschritte: TESTING.md.
