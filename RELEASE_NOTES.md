Jelly+ 0.1.1.0 für Jellyfin 12.2 – Korrekturen für Startseite und TV-Bedienung.

- Ausblenden aktualisiert die Karten nach erfolgreichem Speichern, ohne die Web-App neu zu laden. Auch zwischengespeicherte Karten bleiben verborgen.
- Watch Together erscheint im Medienmenü nur bei aktivierter Profilfreigabe.
- Saisonale Empfehlungen stehen oben auf der Startseite, unterstützen weitere TV-Container und versuchen fehlgeschlagene Anfragen erneut. Die Serverabfrage lädt nur die benötigten Metadaten.
- 21 .NET-Tests und 10 Oberflächentests erfolgreich; Ausblenden ohne Dokumentneustart und beide UI-Korrekturen zusätzlich im TV-Layout eines echten Browsers geprüft.

Nach dem Update den Jellyfin-Container neu starten und die LG-App vollständig schließen und erneut öffnen. Auf physischer LG-Hardware konnte die gemeldete Absturzursache noch nicht abschließend bestätigt werden.

Installationsanleitung und Manifest stehen im Repository. Die Vorschau zielt auf den klassischen Webclient und dessen LG-webOS-TV-Layout. Ein Test auf physischer LG-Hardware steht noch aus; die experimentelle moderne Weboberfläche ist nicht unterstützt. Details und Prüfschritte: TESTING.md.
