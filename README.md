# Planning EMA en blocs

## Changer de personne ou de groupe

Le bouton **Changer de planning** ramène à la page de sélection. Cette page reste toujours dans son affichage original.

La page de connexion est automatiquement détectée et reste elle aussi dans son affichage original afin de ne jamais masquer le formulaire.

Le planning attend désormais le chargement complet des cours et se met à jour automatiquement si le site ajoute des journées après coup. Les événements longs, comme une journée de cohésion de 06:00 à 21:30, sont pris en charge. Une personne ou une promotion ouverte sans date arrive directement sur la semaine actuelle.

Les liens hebdomadaires sans date, par exemple `index.php?url=eleve/20494/week/`, sont également ouverts automatiquement sur la semaine actuelle.

Les cours portant la même référence numérique, par exemple `5.4.2`, utilisent toujours la même couleur dans le calendrier.

Quand une correspondance Campus est connue, cliquer sur un bloc ouvre directement le cours sur `campus2.mines-ales.fr`. Pour une section encore repliée dans Campus, le clic ouvre la catégorie correspondant au numéro du cours.

Le catalogue Campus intégré contient 67 cours MKX12 et de langues. La correspondance utilise le numéro détaillé et l’intitulé du cours ; par exemple, `5.4.2` ouvre directement Électrotechnique.

Les liens Campus s’ouvrent dans un nouvel onglet. Les cours de langues `5.7.1 – Anglais` et `5.7.2 – Langue vivante 2` sont également reconnus.

Les blocs trop courts s’agrandissent au survol pour afficher leurs informations. La grille conserve une marge sous la dernière heure et des coins arrondis en bas.

La détection mesure le contenu réel : un bloc déjà entièrement lisible ne change pas de taille au survol.

Cette extension transforme automatiquement le planning texte de Mines Alès en grille hebdomadaire. Les cours sont placés verticalement selon leur heure de début et leur durée.

## Installation dans Chrome / Edge

1. Ouvrir `chrome://extensions` (ou `edge://extensions`).
2. Activer **Mode développeur**.
3. Cliquer sur **Charger l’extension non empaquetée**.
4. Sélectionner le dossier `extension-planning-ema`.
5. Recharger la page du planning.

## Installation temporaire dans Firefox

1. Ouvrir `about:debugging#/runtime/this-firefox`.
2. Cliquer sur **Charger un module complémentaire temporaire**.
3. Sélectionner `manifest.json` dans ce dossier.
4. Recharger la page du planning.

Le bouton **Voir le planning original** permet de basculer entre les deux présentations.
Les boutons **Jour/Semaine précédent**, **Jour/Semaine suivant** et **Affichage jour/semaine** restent disponibles dans la nouvelle barre de navigation.
Un sélecteur permet également d’ouvrir directement les semaines de l’année scolaire, de la semaine 36 à la semaine 35, ainsi que de passer à l’année scolaire précédente ou suivante.
