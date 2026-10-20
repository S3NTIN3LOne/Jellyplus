# Jelly+

Ein Server-Plugin für **Jellyfin 12.2**, das gemeinsamen Wiedergabefortschritt und zusätzliche Funktionen in Jellyfin Web und dem darauf basierenden LG-webOS-Client bereitstellt.

**Status: erste Vorschau (0.1.0.0).** Die Integration richtet sich an den klassischen Jellyfin-Webclient einschließlich TV-Layout. Die experimentelle moderne Weboberfläche und andere native Clients gehören nicht zum unterstützten Umfang. Ein Test auf einem echten LG-Fernseher steht noch aus.

## Installation auf Unraid / Docker

1. In Jellyfin unter **Dashboard → Plugins → Repositorys** dieses Repository hinzufügen:

   ```text
   https://raw.githubusercontent.com/S3NTIN3LOne/Jellyplus/main/manifest.json
   ```

2. Im Katalog **Jelly+** installieren und den Jellyfin-Container neu starten.
3. Browser neu laden beziehungsweise die LG-App vollständig schließen und wieder öffnen.
4. Unter **Dashboard → Plugins → Jelly+** die serverweiten Einstellungen festlegen.

Das bestehende Docker-Image bleibt unverändert. Kein JavaScript-Injector, zusätzlicher Container oder Reverse-Proxy ist nötig. Jelly+ liest die vorhandene `index.html` und ergänzt nur die HTTP-Antwort um seinen eigenen Script-Verweis. Es schreibt keine Webdateien. Das normale persistente Jellyfin-Konfigurationsvolume muss vorhanden sein, damit Plugins und Einstellungen Container-Updates überstehen.

## Funktionen

### Watch Together

- Unter **Profil → Wiedergabe → Jelly+** aktiviert jeder Nutzer **Watch Together**. Damit gibt er sich für Verknüpfungen durch andere aktivierte Profile frei.
- Im Drei-Punkte-Menü eines Films, einer Serie oder einer Episode **Watch Together** wählen. Episoden verknüpfen die zugehörige Serie.
- Profil auswählen und festlegen, welcher Fortschritt übernommen werden soll. Bei Serien gilt diese Auswahl für die gemeinsam zugänglichen Episoden.
- Abspielposition, Gesehen-Status, Wiedergabezähler und letztes Wiedergabedatum werden geteilt. Favoriten, Bewertungen und Audio-/Untertitelpräferenzen bleiben persönlich.
- Verknüpfungen sind beidseitig und können Gruppen bilden. Die Auswahl beim Verbinden gilt für alle beteiligten Gruppenmitglieder; der Dialog nennt deren Anzahl. Beim späteren Abspielen gewinnt die zuletzt verarbeitete Änderung.
- Bestehende Verknüpfungen lassen sich im gleichen Menü entfernen. Abschalten der Profilfreigabe entfernt sämtliche direkten Verknüpfungen dieses Profils. Bereits übertragener Fortschritt wird nicht rückgängig gemacht.
- Die Bibliotheks- und Altersfreigaben jedes Empfängerprofils werden berücksichtigt. Änderungen während einer offenen Konfliktabfrage führen zu einer erneuten Auswahl.

### Saisonale Empfehlungen

- **01.12.–31.12.: Weihnachten** anhand von Titeln, Beschreibungen, Genres und Tags wie „Christmas“, „Weihnachten“ und „Heiligabend“.
- **15.10.–01.11.: Halloween** einschließlich Horrorfilmen.
- Bis zu 40 passende Filme als eigene Startseitenzeile; administrativ abschaltbar. Es werden nur für das angemeldete Profil zugängliche Medien angezeigt.
- Die Zeiträume sind inklusive; maßgeblich ist die Serverzeitzone. Auf Unraid kann hierfür `TZ=Europe/Berlin` am Container gesetzt werden.

### Zufällig zur Übersicht

Die Admin-Option lässt die Bibliotheks-Schaltfläche **Zufällig** einen zufälligen Titel aus der aktuellen Bibliothek auswählen und dessen Detailseite öffnen. Die Auswahl verwendet die Bibliothek, nicht zusätzliche aktive Ansichtsfilter. Wiedergabe startet erst auf ausdrückliche Auswahl des Nutzers.

### Startseite aufräumen

Im Drei-Punkte-Menü **Aus „Als nächstes“ und „Weiterschauen“ ausblenden** auswählen. Episoden blenden ihre gesamte Serie für das eigene Profil aus. Der Wiedergabefortschritt bleibt erhalten.

Eine Serie kehrt zurück, wenn das Profil eine andere Episode als die zuletzt abgespielte startet. Dabei zählt auch die bisher ungestartete Episode, deren „Als nächstes“-Karte ausgeblendet wurde. Ein Film kehrt bei erneutem Wiedergabestart zurück. Unter **Profil → Wiedergabe → Ausgeblendete Medien verwalten** kann man Medien jederzeit wieder zulassen.

Die Filterung erfolgt nach Jellyfins Seitenauswahl. Daher kann eine Zeile nach dem Ausblenden zunächst weniger Einträge enthalten, als ihre normale maximale Anzahl erlaubt.

## Entwicklung und Tests

Voraussetzungen: .NET SDK 10 und Node.js 24.

```sh
dotnet test -c Release
npm ci --ignore-scripts
npm test
```

Paket und Manifest erstellen (PowerShell 7 oder Windows PowerShell):

```powershell
./scripts/package.ps1 -Version 0.1.0.0 -Repository S3NTIN3LOne/Jellyplus
```

Das ZIP enthält ausschließlich die Plugin-DLL einschließlich eingebetteter Webressourcen. Die Jellyfin-Assemblies liefert der Server. Der GitHub-Workflow **Publish release** erstellt nach erfolgreichen Tests eine Vorabversion und aktualisiert das Manifest. Vor einer stabilen Freigabe die Geräteprüfungen in [TESTING.md](TESTING.md) durchführen.

Jelly+ speichert seine Profilfreigaben, Verknüpfungen und ausgeblendeten Medien atomar unter `<Jellyfin DataPath>/jellyplus/state.json`. Die serverweiten Optionen liegen in der normalen Plugin-Konfiguration. Beim Deinstallieren bleiben diese Daten bestehen; die Oberflächen-Erweiterung entfällt nach Serverneustart und Neuladen des Clients.

## Technische Grenzen

Die UI-Einbindung ist eine versionsgebundene Erweiterung, keine offizielle Jellyfin-Web-Plugin-Schnittstelle. Jellyfin-Web-Updates können Anpassungen erforderlich machen. Der Client muss die Weboberfläche dieses Servers verwenden. Geteilte Fortschritte sind keine synchronisierte Streaming-Sitzung.

Beim erstmaligen Verknüpfen werden Fortschritte über Jellyfins öffentliche Dienste einzeln gespeichert. Ein Fehler kann bereits übertragene Einträge hinterlassen; die Verknüpfung wird erst nach erfolgreichem Kopieren gespeichert. Eine erneute Auswahl gleicht die Einträge ab.

Lizenz: [GPL-3.0-only](LICENSE).
