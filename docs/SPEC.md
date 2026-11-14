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

- 4.1 Une sous-application est un dossier `src/apps/<id>/` qui exporte une fiche et une fabrique. Fiche : `id`, `title`, vignette, `needs` (par exemple `['microphone']`), `settings` (liste déclarative de réglages : identifiant, libellé, type curseur ou interrupteur, bornes, valeur par défaut).
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
- 6.6 Erreurs affichées dans l'interface, en français, avec la marche à suivre : autorisation refusée, aucun micro, micro perdu en cours de route.
- 6.7 Le flux audio n'est ni enregistré ni transmis. Le micro est relâché à l'arrêt de la sous-application.

## SPEC-7 Réglages

- 7.1 Réglages conservés dans `localStorage`, rangés par sous-application, avec un espace commun (calibrage).
- 7.2 L'hôte construit le panneau de réglages à partir de la déclaration de la fiche (SPEC-4.1). Un changement s'applique immédiatement à la sous-application en cours.
- 7.3 En mode un écran, le panneau est accessible depuis le menu. En mode deux écrans, il reste affiché sur la régie pendant que la scène tourne.
- 7.4 Un bouton « Valeurs par défaut » par sous-application.
- 7.5 Pour une sous-application qui déclare le besoin `microphone`, le panneau affiche en plus le niveau sonore en direct et le bouton « Calibrer ».

## SPEC-8 Direction artistique

- 8.1 Public : 4-5 ans. Style papier découpé : aplats de couleur, formes rondes, grands yeux, pas de détail fin, pas de texte.
- 8.2 Lisible de loin sur un vidéoprojecteur : contrastes francs, pas de teintes pâles voisines, éléments importants de grande taille.
- 8.3 Palette limitée (8 à 10 couleurs), définie une fois dans un module partagé et consignée ici par la première tâche graphique.
- 8.4 Graphismes produits en code (SVG écrits à la main ou formes PixiJS). Ressources externes admises seulement sous licence CC0 ou équivalente, listées avec leur source et leur licence dans `CREDITS.md`.
- 8.5 Animations douces et lentes. Rien de clignotant ni de brusque, sauf la fuite des animaux.
- 8.6 L'image s'adapte à tout format d'écran (16:9, 16:10, 4:3) sans déformation ni bandes : le décor s'étend, les éléments importants restent dans une zone centrale sûre.

## SPEC-9 Forêt du silence

- 9.1 But : obtenir le silence. Quand la classe est calme, les animaux sortent et s'approchent ; au bruit, ils ont peur et se cachent. La forêt n'émet aucun son. Besoin déclaré : `microphone`.
- 9.2 Décor : clairière en plusieurs plans (ciel, arbres lointains, arbres proches, sol, premier plan) avec des cachettes identifiables : buisson, tronc creux, terrier, arrière d'un arbre, branche haute. Vie discrète permanente : feuillage qui ondule, nuages lents, rayons de lumière.
- 9.3 Animaux : six, chacun avec sa cachette : écureuil, lapin, hérisson, chouette, renard, faon. Chaque animal est fait de pièces (corps, tête, oreilles, pattes, queue, yeux) animées par code. États : caché ; pointe le museau ; s'approche ; installé (broute, se gratte, s'endort, cligne des yeux) ; en alerte (figé, oreilles dressées, yeux grands ouverts) ; en fuite (course rapide vers sa cachette).
- 9.4 Logique. L'écart au bruit ambiant (SPEC-6.4) définit trois zones : calme (sous le seuil d'alerte), alerte (entre les deux seuils), bruit (au-dessus du seuil de fuite).
- 9.4.1 Une jauge de calme monte tant que la zone est calme. Chaque animal a un palier sur la jauge : au palier il pointe le museau, puis s'approche et s'installe. Ordre du moins timide au plus timide : écureuil, lapin, hérisson, chouette, renard, faon. Le premier animal sort après 5 secondes de calme environ ; la durée totale est réglable (SPEC-9.6).
- 9.4.2 Zone d'alerte : les animaux sortis se figent et la jauge s'arrête. Si l'alerte dure plus que la tolérance, ils fuient.
- 9.4.3 Zone de bruit : fuite immédiate de tous les animaux sortis.
- 9.4.4 Après une fuite, la jauge repart de zéro et ne remonte qu'après 2 secondes de calme.
- 9.4.5 La logique est un module pur (entrées : écart en dB et temps écoulé ; sorties : jauge et état de chaque animal), sans dépendance au rendu, couvert par des tests.
- 9.5 Récompense : quand les six animaux sont installés, la clairière s'anime doucement (lucioles ou papillons, lumière plus chaude) tant que le calme dure. Aucune récompense sonore.
- 9.6 Réglages déclarés, valeurs de départ à ajuster en classe : sensibilité (seuil d'alerte en dB au-dessus du bruit ambiant, défaut 6 ; seuil de fuite = seuil d'alerte + 6) ; durée pour que tous les animaux soient là (30 s à 5 min, défaut 90 s) ; tolérance d'alerte (0 à 2 s, défaut 0,5 s). Le panneau affiche les deux seuils sur le niveau sonore en direct (SPEC-7.5).
- 9.7 Aucun indicateur de bruit n'est projeté : les animaux sont l'indicateur.

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
