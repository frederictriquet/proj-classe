# Spécification de l'application de classe

Décisions arrêtées avec l'utilisateur le 2026-11-14. Chaque tâche relit les sections qu'elle implémente et les cite dans le code sous la forme `[SPEC-n]`.

## SPEC-1 Objet et contraintes

- Nom de l'application, affiché dans le Dock et sur le menu : « Proj-Classe ».
- Application pour une classe d'enfants de 4-5 ans, lancée par l'enseignante sur un MacBook récent (puce Apple) équipé de Chrome, image projetée par un vidéoprojecteur.
- Elle donne accès à plusieurs sous-applications depuis un menu. On revient au menu depuis toute sous-application.
- Elle fonctionne sans connexion internet. Elle se met à jour seule depuis GitHub quand le réseau est là, sans action de l'enseignante.
- Seul l'adulte pilote (clavier, trackpad). Les enfants regardent.
- Aucune donnée ne quitte le Mac. Le son du micro est mesuré, jamais enregistré ni transmis.
- Interface de l'adulte en français. Aucun texte à lire côté enfants.

## SPEC-2 Stack et enveloppe

- 2.1 Application web installable (PWA), installée depuis Chrome, hébergée sur GitHub Pages depuis un dépôt public. Raison : pas de compte Apple Developer, donc pas d'application native signée ; d'après les sources consultées, une application native non signée perdrait l'autorisation micro à chaque mise à jour.
- 2.2 TypeScript, Vite, vite-plugin-pwa (Workbox), PixiJS v8 pour le rendu 2D, Web Audio API pour le micro, Vitest pour la logique pure. Pas de framework d'interface : menu et panneaux en DOM et CSS.
- 2.3 Aucune ressource chargée depuis un autre domaine à l'exécution (pas de CDN, pas de police distante) : tout est dans le build.
- 2.4 Le cœur ne dépend pas de l'enveloppe, pour pouvoir l'emballer plus tard dans Tauri si un besoin natif apparaît.
- 2.5 Git : branche `master`, Conventional Commits, commentaires de code et commits en anglais. Déploiement par GitHub Actions à chaque push sur `master`.

## SPEC-3 Hors ligne et mise à jour

- 3.1 Tous les fichiers du build sont mis en cache par le service worker à l'installation (precache complet). L'application démarre et fonctionne entièrement sans réseau.
- 3.2 L'application demande le stockage persistant (`navigator.storage.persist()`) et affiche le résultat dans le diagnostic.
- 3.3 Mise à jour : vite-plugin-pwa avec `registerType: 'autoUpdate'`. À chaque lancement avec réseau, la nouvelle version est téléchargée en arrière-plan. Elle n'est appliquée (rechargement) que lorsque le menu est affiché, jamais pendant une sous-application.
- 3.4 Le menu affiche le numéro de version (version de `package.json` et hash court du commit) et, après une mise à jour, le message « Mise à jour installée » pendant quelques secondes. Sans réseau, aucun message : c'est le fonctionnement normal.
- 3.5 Ouverte dans un onglet Chrome (non installée), l'application affiche un bouton « Installer » (événement `beforeinstallprompt`).
- 3.6 Un échec de mise à jour autre que l'absence de réseau s'affiche sur le menu, avec la version restée en service.
- 3.7 Le menu affiche un témoin d'état hors ligne. « Prête hors ligne » apparaît seulement quand tous les fichiers du build sont dans le cache du service worker (même contrôle que la page de diagnostic). Tant que ce n'est pas le cas, le témoin indique « Téléchargement en cours ».
- 3.8 Consigne pour l'enseignante, affichée au clic sur le témoin : « Si les données de navigation de Chrome ont été effacées, ouvrez l'application une fois avec une connexion internet avant la classe. » Raison : effacer les données de navigation de Chrome supprime l'application du disque, et le stockage persistant (SPEC-3.2) n'en protège pas. Un lancement avec réseau la retélécharge.

SPEC-3.9 Version défectueuse et retour arrière
- 3.9.1 Garde avant publication : après le build, le workflow de déploiement lance un test de démarrage dans Chromium sans interface, sur le build servi localement. Le test vérifie que le menu s'affiche, qu'aucune erreur non rattrapée n'est levée, que le service worker s'enregistre, que le cache est complet et que la page se recharge réseau coupé. Un échec empêche la publication.
- 3.9.2 Amorce indépendante : l'enregistrement du service worker, la recherche et l'application d'une nouvelle version sont dans un module d'amorce chargé avant le reste de l'application et sans dépendance vers lui. Une erreur au démarrage de l'application n'empêche ni la recherche ni l'application d'une nouvelle version.
- 3.9.3 Écran de secours : si l'application ne démarre pas (erreur non rattrapée avant l'affichage du menu), l'amorce affiche un écran en français avec le numéro de version et la consigne « L'application a rencontré un problème. Connectez le Mac à internet puis relancez-la. ». Dans cet état, une nouvelle version est appliquée dès qu'elle est téléchargée, sans attendre le menu (exception à SPEC-3.3).
- 3.9.4 Retour arrière : annuler le commit fautif sur `master` (`git revert`) et pousser. La version rétablie est publiée par le workflow habituel et prise par l'application installée au lancement suivant avec réseau. La procédure est décrite dans `README.md`.
- 3.9.5 Limite assumée : sans réseau, une version défectueuse déjà installée reste en place jusqu'au prochain lancement avec réseau. Aucune copie de la version précédente n'est conservée sur le Mac.

## SPEC-4 Contrat de sous-application et menu

- 4.1 Une sous-application est un dossier `src/apps/<id>/` qui exporte une fiche et une fabrique. Fiche : `id`, `title`, vignette, `needs` (par exemple `['microphone']`), `settings` (liste déclarative de réglages : identifiant, libellé, type curseur ou interrupteur, bornes, valeur par défaut). Une sous-application qui écoute le micro peut déclarer ses seuils sonores, tous réglés par un même curseur en dB au-dessus du bruit ambiant, et le nom de chaque zone qu'ils délimitent (SPEC-7.5).
- 4.2 Cycle de vie : `start(context)` reçoit le conteneur d'affichage et les services (niveau sonore, réglages) ; `stop()` libère tout (boucle d'animation, écouteurs, micro, textures). Après `stop()`, rien ne tourne.
- 4.3 Les sous-applications sont chargées à la demande (`import()` dynamique). Le registre des fiches est la seule liste à compléter pour en ajouter une.
- 4.4 Une sous-application ne dessine aucun contrôle pour l'adulte : elle déclare ses réglages, l'hôte les affiche (SPEC-7).
- 4.5 Menu : grille de grandes vignettes illustrées, pilotable à la souris et au clavier (flèches, Entrée).
- 4.6 Au lancement, la sous-application passe en plein écran. Retour au menu : touche Échap (la sortie du plein écran ramène au menu).
- 4.7 Si un besoin déclaré n'est pas satisfait (micro refusé), l'hôte affiche un message en français qui dit quoi faire, au lieu de lancer la sous-application.
- 4.8 Une erreur à l'exécution d'une sous-application ramène au menu avec un message visible.

## SPEC-5 Écrans : régie et scène

- 5.1 Deux rôles. La régie est l'écran du Mac : menu, réglages, niveau sonore, retour au menu. La scène est ce que voient les enfants : la sous-application seule, sans aucun contrôle.
- 5.2 Avec un seul écran (ou en recopie vidéo), une seule fenêtre joue les deux rôles tour à tour : menu, puis scène en plein écran (SPEC-4.6).
- 5.3 Avec deux écrans (bureau étendu), la régie propose « Projeter ». La scène s'ouvre dans une seconde fenêtre placée sur l'autre écran, en plein écran, par la Window Management API de Chrome (`getScreenDetails()`, `window.open` aux coordonnées de l'écran, `requestFullscreen({ screen })`).
- 5.4 Repli si l'API est absente ou refusée : la fenêtre scène s'ouvre et un message invite à la glisser sur le projecteur puis à cliquer pour passer en plein écran.
- 5.5 La sous-application et la mesure du micro tournent dans la fenêtre scène, toujours visible. La régie est une télécommande : elle envoie les commandes (lancer, arrêter, changer un réglage) et reçoit l'état (niveau sonore, état de la sous-application) par `BroadcastChannel`.
- 5.6 Fermer la scène ou débrancher le projecteur ramène la régie au mode un écran, avec un message et sans plantage.

## SPEC-6 Service de niveau sonore

- 6.1 Capture par `getUserMedia` avec `echoCancellation: false`, `noiseSuppression: false`, `autoGainControl: false`. Vérifier avec `track.getSettings()` et signaler dans le diagnostic si un traitement reste actif. Raison : le gain automatique fausse la mesure.
- 6.2 Mesure : valeur efficace (RMS) du signal temporel d'un `AnalyserNode`, convertie en dBFS, lissée (montée rapide, descente plus lente), rafraîchie à chaque image.
- 6.3 Calibrage : mesure du bruit ambiant de la salle pendant 3 secondes, déclenchée par l'adulte. La valeur est conservée (SPEC-7). Sans calibrage, une valeur par défaut est utilisée.
- 6.4 Le service expose le niveau lissé et l'écart au bruit ambiant calibré, en dB. Les seuils appartiennent aux sous-applications.
- 6.5 Source simulée pour le développement et les tests : niveau piloté au clavier ou par un curseur, activée par un paramètre d'URL, même interface que la source micro.
- 6.6 Erreurs affichées dans l'interface, en français, avec la marche à suivre : autorisation refusée, aucun micro, micro choisi introuvable, micro perdu en cours de route, micro qui ne renvoie que du silence.
- 6.7 Le flux audio n'est ni enregistré ni transmis. Le micro est relâché à l'arrêt de la sous-application.
- 6.8 Choix du micro : le panneau propose « Micro choisi par Chrome » (aucune contrainte, valeur par défaut) puis les micros branchés, sans les entrées « default » et « communications » de Chrome. Le choix est conservé dans l'espace commun (SPEC-7.1) et s'applique aussitôt : un micro ouvert est rouvert avec le nouveau choix. Changer de micro efface le calibrage, propre à chaque micro. Raison : Chrome peut ouvrir un micro virtuel muet (Hue Sync Audio, constaté le 2026-11-15) alors que macOS a un autre micro par défaut.

## SPEC-7 Réglages

- 7.1 Réglages conservés dans `localStorage`, rangés par sous-application, avec un espace commun (calibrage, micro choisi).
- 7.2 L'hôte construit le panneau de réglages à partir de la déclaration de la fiche (SPEC-4.1). Un changement s'applique immédiatement à la sous-application en cours.
- 7.3 En mode un écran, le panneau est accessible depuis le menu. En mode deux écrans, il reste affiché sur la régie pendant que la scène tourne.
- 7.4 Un bouton « Valeurs par défaut » par sous-application.
- 7.5 Pour une sous-application qui déclare le besoin `microphone`, le panneau affiche en plus, de haut en bas : le choix du micro (SPEC-6.8) ; le niveau sonore en direct sur une barre graduée en écart au bruit ambiant, avec un trait par seuil déclaré (SPEC-4.1) ; le curseur des seuils, placé sous la barre, de même échelle qu'elle, son pouce sur le premier trait ; la zone du niveau, nommée par la sous-application ; les erreurs et avertissements du micro (SPEC-6.6). Viennent ensuite les autres réglages, puis en bas le calibrage : date du dernier calibrage et bouton « Calibrer ». Sans seuil déclaré, la barre va de 0 à 60 dB au-dessus du bruit ambiant, sans curseur ni zone. Aucune valeur en dB n'est affichée dans le panneau : le diagnostic les donne (niveau, bruit ambiant calibré, écart au bruit ambiant, seuils de chaque sous-application).

## SPEC-8 Direction artistique

- 8.1 Public : 4-5 ans. Style papier découpé : aplats de couleur, formes rondes, grands yeux, pas de détail fin, pas de texte.
- 8.2 Lisible de loin sur un vidéoprojecteur : contrastes francs, pas de teintes pâles voisines, éléments importants de grande taille.
- 8.3 Chaque activité a sa palette limitée (8 à 10 couleurs), définie dans son dossier et consignée ici (décision du 2026-11-15). Chaque palette comprend une encre (pupilles, ombres du papier) et une crème (blanc des yeux) : le code commun des activités du silence (SPEC-9.8) dessine avec elles et ne contient aucune couleur.
- 8.3.1 Palette de la forêt (dix couleurs, `src/apps/foret/palette.ts`) : encre `#1B1B1B` (pupilles, trous, ombres), crème `#FBF6E9` (nuages, yeux, ventres, rayons), soleil `#F4C430` (soleil, fleurs, yeux de la chouette, lucioles), ciel `#8ED1F0`, sarcelle `#5E9E9A` (arbres lointains), herbe `#7CC36A` (sol de la clairière), forêt `#2E6B3F` (feuillages, buisson, lisière, fougères), écorce `#7A4A26` (troncs, branche, terre, pelage sombre), fauve `#D9A066` (bois coupé, pelage clair, faces), orange `#D9622B` (renard, écureuil).
- 8.3.2 Une activité ne dessine aucune autre teinte que celles de sa palette : ombres du papier, lumière et profondeur utilisent ces couleurs en transparence. Dans la forêt, le fauve est trop proche de l'herbe en luminosité pour s'y poser seul.
- 8.4 Graphismes produits en code (SVG écrits à la main ou formes PixiJS). Ressources externes admises seulement sous licence CC0 ou équivalente, listées avec leur source et leur licence dans `CREDITS.md`.
- 8.5 Animations douces et lentes. Rien de clignotant ni de brusque, sauf la fuite des animaux.
- 8.6 L'image s'adapte à tout format d'écran (16:9, 16:10, 4:3) sans déformation ni bandes : le décor s'étend, les éléments importants restent dans une zone centrale sûre.

## SPEC-9 Forêt du silence

- 9.1 But : obtenir le silence. Quand la classe est calme, les animaux sortent et s'approchent ; au bruit, ils ont peur et se cachent. La forêt n'émet aucun son. Besoin déclaré : `microphone`.
- 9.2 Décor : clairière en plusieurs plans (ciel, arbres lointains, arbres proches, sol, premier plan) avec des cachettes identifiables : buisson, tronc creux, terrier, arrière d'un arbre, branche haute. Vie discrète permanente : feuillage qui ondule, nuages lents, rayons de lumière.
- 9.3 Animaux : six, chacun avec sa cachette : écureuil, lapin, hérisson, chouette, renard, faon. Chaque animal est fait de pièces (corps, tête, oreilles, pattes, queue, yeux) animées par code. États : caché ; pointe le museau ; s'approche ; installé (broute, se gratte, s'endort, cligne des yeux) ; en alerte (figé, oreilles dressées, yeux grands ouverts) ; en fuite (course rapide vers sa cachette).
- 9.4 Logique. L'écart au bruit ambiant (SPEC-6.4) définit trois zones : calme (sous le seuil d'alerte), alerte (entre les deux seuils), bruit (au-dessus du seuil de fuite).
- 9.4.1 Une jauge de calme monte tant que la zone est calme. Chaque animal a un palier sur la jauge : au palier il pointe le museau, puis s'approche et s'installe. Ordre du moins timide au plus timide : écureuil, lapin, hérisson, chouette, renard, faon. Le délai avant le premier animal et l'intervalle entre deux animaux sont réglables indépendamment (SPEC-9.6, décision du 2026-11-15). Le premier palier vaut le délai initial, puis chaque palier ajoute l'intervalle ; les pauses d'alerte ne comptent pas. Ces délais déclenchent le début de la sortie, avant le temps d'approche et d'installation.
- 9.4.2 Zone d'alerte : les animaux sortis se figent et la jauge s'arrête. Si l'alerte dure plus que la tolérance, ils fuient.
- 9.4.3 Zone de bruit : fuite immédiate de tous les animaux sortis.
- 9.4.4 Après une fuite, la jauge repart de zéro et ne remonte qu'après 2 secondes de calme.
- 9.4.5 La logique est un module pur (entrées : écart en dB et temps écoulé ; sorties : jauge et état de chaque animal), sans dépendance au rendu, couvert par des tests.
- 9.5 Récompense : quand les six animaux sont installés, la clairière s'anime doucement (lucioles ou papillons, lumière plus chaude) tant que le calme dure. Aucune récompense sonore.
- 9.6 Quatre réglages déclarés, valeurs de départ à ajuster en classe : sensibilité (seuil d'alerte en dB au-dessus du bruit ambiant, de 2 à 80 dB pour que le curseur ne bloque jamais l'adulte, défaut 6 ; seuil de fuite = seuil d'alerte + 6) ; délai de calme avant le premier animal (5 s à 5 min, pas de 5 s, défaut 90 s) ; délai de calme entre deux animaux (5 s à 5 min, pas de 5 s, défaut 30 s) ; tolérance d'alerte (0 à 2 s, défaut 0,5 s). Le délai initial remplace l'ancienne durée totale et conserve sa valeur enregistrée : un ancien réglage de 300 s fait désormais attendre 5 minutes avant la première sortie. Le panneau nomme le premier animal de l'activité (« Délai de calme avant l’écureuil » dans la forêt, « Délai de calme avant la poule » dans la ferme) et affiche « Délai de calme entre deux animaux » pour l'intervalle. Les réglages s'appliquent immédiatement sans faire rentrer les animaux déjà sortis ; raccourcir les délais fait sortir ceux dont le nouveau palier est déjà atteint. Le panneau affiche les deux seuils sur le niveau sonore en direct, le curseur de sensibilité sous la barre et la zone (SPEC-7.5) : « Calme : les animaux sortent », « Alerte : les animaux se figent, puis fuient si ça dure », « Trop de bruit : les animaux fuient ».
- 9.7 Les animaux sont l'indicateur pour les enfants. Pour l'adulte, un mini-sonomètre est projeté en bas à gauche de la scène (décision du 2026-11-15) : barre verticale de 6 pixels de large et d'un quart de la hauteur de l'écran, qui montre en direct l'écart au bruit ambiant (SPEC-6.4) sur une échelle fixe allant de 6 dB sous le bruit ambiant à 90 dB au-dessus (au-delà du seuil de fuite le plus haut), avec un trait au seuil d'alerte et un trait au seuil de fuite (SPEC-9.6). Couleurs de la palette uniquement (SPEC-8.3.2). C'est un affichage, pas un contrôle (SPEC-4.4).
- 9.8 Code commun (décision du 2026-11-15). Le comportement et les états des animaux (9.3), la logique (9.4), le déclenchement et le fondu de la récompense (9.5), les réglages (9.6) et le mini-sonomètre (9.7) sont communs à la forêt, à la ferme (SPEC-12) et à la ruche (SPEC-13), dans `src/silence/`. Un animal marche, saute ou vole (SPEC-13.2.3). Chaque activité fournit son décor et ses cachettes, ses animaux (ordre de sortie, dessins, trajets), sa palette (SPEC-8.3), le dessin de sa récompense et les couleurs du mini-sonomètre. Le nombre d'animaux est propre à l'activité ; le même intervalle réglé s'applique quel que soit ce nombre. La dernière sortie commence au délai initial plus (nombre d'animaux − 1) fois l'intervalle.

## SPEC-10 Points à vérifier sur le Mac de l'enseignante

| Point | Résultat | Date |
| --- | --- | --- |
| V1 L'autorisation micro est conservée entre deux lancements de l'application installée. | | |
| V2 L'application installée démarre et fonctionne Wi-Fi coupé, y compris après un redémarrage du Mac. | | |
| V3 Une nouvelle version publiée est prise sans action au lancement suivant avec réseau. | | |
| V4 Dans l'application installée, la scène s'ouvre en plein écran sur le projecteur (Window Management API). Aucune source consultée ne couvre le cas de l'application installée. | | |
| V5 `navigator.storage.persist()` répond `true`. | | |
| V6 `track.getSettings()` confirme les trois traitements audio désactivés et le niveau affiché reste stable à bruit constant. | | |
| V7 Sous le chemin `/nom-du-depot/` de GitHub Pages, le cache hors ligne est complet. | | |
| V8 Si le Mac est géré par un établissement, l'installation depuis Chrome est autorisée. | | |
| V9 L'animation d'essai du diagnostic tient au moins 50 images par seconde en plein écran sur le projecteur. | | |
| V10 Après effacement des données de navigation de Chrome (cookies et données de sites), l'application installée se rétablit seule au lancement suivant avec réseau, puis redémarre Wi-Fi coupé. | | |

## SPEC-11 Hors périmètre pour l'instant

- Sortie audio des sous-applications (à traiter quand l'une d'elles en aura besoin : le micro captera le son émis).
- Écran tactile et interaction des enfants.
- Micro externe.
- Navigateurs autres que Chrome.
- Application native.

## SPEC-12 Ferme du silence

Décisions du 2026-11-15.

- 12.1 Titre sur le menu : « Ferme du silence ». Même but et même code commun que la forêt (SPEC-9.1, SPEC-9.8), dans un décor de ferme. La ferme n'émet aucun son. Besoin déclaré : `microphone`.
- 12.2 Huit animaux, du moins timide au plus timide, chacun avec sa cachette : poule (poulailler sur pilotis : sort par la petite porte et descend la rampe) ; cheval (grange : passe la tête par la grande porte) ; lapin (potager : derrière les choux) ; mouton (meule de foin : sort sur le côté) ; cochon (porcherie : derrière la palissade) ; vache (grange, par la même porte que le cheval) ; canard (mare : derrière les roseaux) ; chèvre (meule de foin : pointe la tête par-dessus, puis s'installe au sommet). Mêmes états et mêmes activités que les animaux de la forêt (SPEC-9.3).
- 12.3 Décor en plusieurs plans (SPEC-8.6) : ciel ; collines et champs au loin ; bâtiments (grange rouge à gauche, poulailler au fond à droite, porcherie à droite) ; cour au centre ; meule de foin, potager et mare au premier plan. Le cheval et la vache s'installent au fond de la cour, près de la grange, pour ne pas cacher les petits animaux. Vie discrète permanente : nuages lents, roseaux et choux qui ondulent.
- 12.4 Récompense : quand les huit animaux sont installés, un arc-en-ciel se lève lentement au-dessus des collines et la lumière se réchauffe, tant que le calme dure (fondu commun, SPEC-9.8). Aucune récompense sonore.
- 12.5 Palette de la ferme (SPEC-8.3, dix couleurs, `src/apps/ferme/palette.ts`) : encre `#1B1B1B` (pupilles, portes sombres, ombres, tête du mouton), crème `#FBF6E9` (nuages, yeux, laine, poule, vache), ciel `#8ED1F0`, herbe `#5FAA4D` (cour, collines), feuillage `#2E6B3F` (collines lointaines, arbres, choux, roseaux), rouge `#B23828` (grange, toits, crête, bec du canard, arc-en-ciel), paille `#F8D45A` (foin, blé, soleil, canard, cornes), brun `#7A4A26` (bois, boue, cheval, chèvre), rose `#EE9AAE` (cochon, museaux, oreilles du lapin), bleu `#24689A` (mare, arc-en-ciel). Le rose du cochon est proche de l'herbe en luminosité : le cochon s'installe sur la boue devant la porcherie, pas sur l'herbe.

## SPEC-13 Ruche du silence

Décisions du 2026-11-15.

- 13.1 Titre sur le menu : « Ruche du silence ». Même but et même code commun que la forêt et la ferme (SPEC-9.1, SPEC-9.8), dans un décor de ruche et de prairie fleurie. La ruche n'émet aucun son, pas même un bourdonnement (SPEC-11). Besoin déclaré : `microphone`.
- 13.1.1 Libellé du délai initial dans le panneau : « Délai de calme avant la première abeille ». Le premier animal est nommé dans la fiche de l'activité. L'intervalle garde le libellé commun « Délai de calme entre deux animaux » et les trois zones gardent « les animaux » (SPEC-9.6).
- 13.2 Dix-sept animaux : quinze abeilles, puis deux papillons, les derniers dans l'ordre de sortie (les plus timides). Avec les réglages par défaut, la première abeille sort après 90 s de calme puis un nouvel animal toutes les 30 s ; le dernier papillon commence sa sortie à 570 s (9 min 30 s). L'intervalle est réglable indépendamment du délai initial (SPEC-9.4.1, SPEC-9.8).
- 13.2.1 Abeilles : rondes, sans dard, environ 80 unités de haut sur les 1080 de la zone sûre, soit 7,5 % de la hauteur de l'écran (les plus petits animaux de la ferme en font 96 à 104). Toutes se cachent dans la ruche. Chacune pointe la tête au trou d'envol, avec un léger décalage d'une abeille à l'autre pour que plusieurs têtes restent visibles quand les sorties se suivent de près, puis vole lentement jusqu'à sa place : la plupart sur les fleurs de la prairie, deux ou trois sur le rayon de miel, une ou deux sur la planche d'envol.
- 13.2.2 Papillons : cachés derrière une touffe de grandes fleurs au premier plan. Installés, ils se posent sur les deux plus grandes fleurs et ouvrent et ferment lentement les ailes.
- 13.2.3 États d'un animal qui vole, sur ceux de SPEC-9.3 : caché ; pointe le museau (tête et antennes hors de la cachette) ; s'approche en vol lent et sinueux ; installé et posé, avec les cinq activités communes réinterprétées sans en ajouter : repos (ailes repliées), butine (tête dans la fleur, à la place de broute), se nettoie les antennes (à la place de se gratte), s'endort, regarde les enfants ; en alerte, posé, il se fige, antennes dressées et yeux grands ouverts, et en vol il s'arrête en vol stationnaire, les ailes battant toujours ; en fuite, vol rapide et direct vers sa cachette, en moins d'une seconde (SPEC-8.5).
- 13.2.4 Battement d'ailes : lent et ample, 2,5 battements par seconde, ailes crème opaques. Jamais de battement rapide, qui ressemblerait à un clignotement (SPEC-8.5). Choisi sur la galerie des animaux, préféré à des ailes translucides qui vibrent à peine.
- 13.3 Décor en plusieurs plans (SPEC-8.6) : ciel ; collines et haie au loin ; à gauche, une ruche en bois à toit à deux pentes avec sa planche d'envol ; contre elle, un grand cadre de rayon de miel aux alvéoles hexagonales, certaines pleines de miel, d'autres vides ; un pot de miel sur une souche ; prairie fleurie au premier plan, avec la touffe de grandes fleurs des papillons. Vie discrète permanente : fleurs qui ondulent, nuages lents, goutte de miel qui se forme et coule lentement au bord du rayon.
- 13.4 Récompense : quand les dix-sept animaux sont installés, les alvéoles vides du rayon se remplissent de miel une à une, un filet de miel coule du rayon dans le pot et la lumière se réchauffe, tant que le calme dure (déclenchement et fondu communs, SPEC-9.5, SPEC-9.8). Aucune récompense sonore. Le rayon ne se remplit pas au fil des sorties : le code commun n'est pas modifié pour la récompense.
- 13.5 Palette de la ruche (SPEC-8.3, dix couleurs, `src/apps/ruche/palette.ts`, décision du 2026-11-15) : encre `#1B1B1B` (pupilles, rayures des abeilles, intérieur de la ruche, ombres), crème `#FBF6E9` (nuages, yeux, ailes, marguerites, parois de cire du rayon, pot de miel), ciel `#55A8DC`, herbe `#66B356` (prairie), feuille `#2E6B3F` (collines lointaines, haie, tiges, touffe des papillons), jaune `#FFD43B` (abeilles, soleil, cœur des fleurs roses et bleues), miel `#B4601C` (alvéoles pleines, goutte, miel du pot, bois de la ruche), brun `#6B3F1F` (cadre du rayon, alvéoles vides, planche d'envol, souche, pieds), bleu `#2C5F9E` (toit de la ruche, bleuets), rose `#B8336A` (fleurs de la prairie, les deux grandes fleurs des papillons).
- 13.5.1 Le jaune de l'abeille est plus clair que l'herbe et que le ciel, assez pour s'en détacher : le ciel est donc plus soutenu que celui de la forêt et de la ferme. Le jaune et l'encre de l'abeille se détachent des fleurs roses et bleues, du miel, des alvéoles vides, de la planche d'envol, de l'herbe, du ciel et des feuilles (`palette.test.ts`).
- 13.5.2 Le risque signalé du rayon ambré ne se présente pas : le miel est plus sombre que le jaune de l'abeille. Le jaune est en revanche trop proche du crème, comme le cochon sur l'herbe (SPEC-12.5). Aucune abeille ne se pose sur du crème : pas sur les marguerites, dont le cœur est couleur miel, et, sur le rayon, seulement sur les alvéoles pleines du haut, loin des alvéoles vides que remplit la récompense (SPEC-13.4).
- 13.5.3 Le bois de la ruche et le cadre du rayon sont trop proches de la feuille en luminosité : les collines s'abaissent derrière eux. La tête d'une abeille qui pointe au trou d'envol n'est pas à l'encre, couleur de l'intérieur de la ruche.
- 13.5.4 Les papillons, crème ou jaunes, se détachent des deux grandes fleurs roses, de l'herbe et de la touffe. Ils ne sont ni bleus ni roses : ces couleurs se confondent avec la touffe.
