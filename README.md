# ActiPlan

Een gevibecode website voor het maken van activiteitenplanningen. De planning staat in een leesbaar JSON-bestand; er is geen backend, account of automatische browseropslag.

## Projectstructuur

- `index.html` - applicatiescherm.
- `css/styles.css` - scherm- en A4-printopmaak.
- `css/components.css` - gedeelde interactieve componenten en toegankelijkheidsstijlen.
- `js/core.js` - JSON-validatie, kalender-, herhalings- en ordeningslogica.
- `js/app.js` - gebruikersinterface, bewerken, importeren en opslaan.
- `js/ui.js` - gedeelde UI-hulpfuncties.
- `js/dialogs.js` - consistente bevestigings- en invoerdialogen.
- `tests/` - zelfstandige browser-tests zonder externe bibliotheken.
- `manifest.json` - basisinstellingen voor statische hosting.

## Gebruiken en testen

Open `index.html` direct in Edge of Firefox, of publiceer de map als statische site. Kies daarna een bestaande `.json`-planning, maak een nieuwe planning of laad de voorbeeldplanning.

Open `tests/tests.html` om de automatische tests uit te voeren. De tests controleren onder meer JSON opslaan/importeren, deadlines en printrelevante activiteiten. Een deadline buiten de tijden van het gekozen dagdeel geeft in het activiteitformulier een waarschuwing; opslaan blijft mogelijk wanneer dit bewust gewenst is. Niet-opgeslagen wijzigingen worden tijdelijk lokaal bewaard en bij een volgend bezoek aangeboden voor herstel. Voor lokale ontwikkeling is geen installatie of buildproces nodig. Een lokale webserver kan nodig zijn wanneer een browser ES-modules vanaf `file://` blokkeert.