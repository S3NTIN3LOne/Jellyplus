# Validierung

## Durchgeführte Integrationstests

Am 20.10.2026 lokal mit dem offiziellen Jellyfin-12.2-Windows-Paket und Edge (headless):

- Plugin lädt, HTML-Einbindung aktiv, Profiloption im echten Webclient sichtbar.
- Saisonale Zeile mit lokalem Horror-Testfilm sichtbar.
- Drei-Punkte-Menü → Profilauswahl → Fortschrittsübernahme erfolgreich.
- Bibliotheks-Zufällig-Button öffnet eine Detailseite, ohne Wiedergabe zu starten.
- Zwei echte Testprofile: Gesehen/Ungesehen in beide Richtungen und Position von 120 Sekunden übertragen.
- Serienverknüpfung umfasst beide Testepisoden; Episodenstatus wird übertragen.
- „Weiterschauen“ und „Als nächstes“ filtern ausgeblendete Medien; manuelles Wiederanzeigen und Rückkehr bei anderer Episode geprüft.

Diese Prüfungen ergänzen die automatisierten Tests; sie ersetzen die noch ausstehende Geräteabnahme auf Unraid und LG webOS nicht.

## Automatisiert

- Saisonale Datumsgrenzen, Metadatenzuordnung und Profilgruppen.
- Persistenz nach Neustart und Rücknahme fehlgeschlagener Zustandsänderungen.
- Erforderliche Freigabe beider Profile und Zugriff auf das Medium.
- Fortschrittsübernahme in beide Richtungen ohne Übernahme persönlicher Favoriten.
- Ablehnung veralteter Konfliktentscheidungen und Ende der Synchronisierung nach Deaktivierung.
- Wiederherstellen ausgeblendeter Filme beim Wiedergabestart.
- HTML-Einbindung mit und ohne Base URL, unveränderte Dateien und unberührte Streamingpfade.
- DOM-Tests für Profilfreigabe, Drei-Punkte-Menü, sichere Metadatendarstellung, Zufällig zur Übersicht und Fernbedienungstasten im Dialog.

## Geräteabnahme vor stabiler Freigabe

Auf dem Unraid-Server und einem echten LG-webOS-Gerät prüfen:

1. Plugin über Manifest installieren; Container und TV-App neu starten. Webdateien bleiben unverändert.
2. Zwei Testprofile mit unterschiedlich eingeschränkten Bibliotheken verwenden. Beide aktivieren Watch Together.
3. Film und Serie jeweils mit abweichendem Fortschritt verknüpfen; beide Ausgangsprofile ausprobieren. Nicht zugängliche Medien dürfen nicht übertragen werden.
4. Im Browser starten, am TV stoppen; Fortschritt und Gesehen-Status beim Partner prüfen. Auch „als ungesehen markieren“ prüfen.
5. Freigabe deaktivieren und kontrollieren, dass weitere Änderungen nicht übertragen werden.
6. Film und Episode ausblenden. Die Serie darf erst beim Start einer anderen Episode zurückkehren. Manuelles Wiederanzeigen prüfen.
7. Saisonale Zeile innerhalb und außerhalb beider Zeiträume sowie bei deaktivierter Admin-Option prüfen.
8. Zufällig in Film- und Serienbibliothek führt zur Detailseite; deaktivierte Option behält Jellyfins Verhalten bei.
9. Alle Dialoge mit Pfeiltasten, OK und Zurück bedienen, einschließlich langer Profilnamen und vieler Profile.
10. Jellyfin mit konfigurierter Base URL hinter dem vorhandenen Proxy prüfen und Container erneut erstellen; persistierte Einstellungen müssen erhalten bleiben.

Ein erfolgreicher Build oder DOM-Test allein bestätigt keine vollständige Kompatibilität mit allen webOS-Versionen.
