# Validation sur le Mac de l'enseignante

Marche à suivre pour les points V1 à V10 de `docs/SPEC.md` (SPEC-10), à dérouler sur le MacBook de la classe avec Chrome.

Adresse de l'application : https://frederictriquet.github.io/proj-classe/

Durée : environ une heure, redémarrage du Mac compris. Les essais V4 et V9 demandent le vidéoprojecteur (ou un second écran) et son câble.

Entre l'installation et le dernier essai, aucune nouvelle version n'est publiée, sauf la version de test de V3.

## Préparatifs

- Mac branché sur secteur, Wi-Fi actif.
- Dans Chrome, ouvrez `chrome://settings/help` : laissez Chrome se mettre à jour s'il le propose, puis relancez-le.
- Gardez sous la main de quoi noter : une ligne par point, avec ce que vous avez vu (modèle en fin de page).

## Étape 1 : installation (V8)

1. Ouvrez `chrome://management` dans Chrome. Notez si la page indique que le navigateur est géré par une organisation (cas d'un Mac fourni par l'établissement).
2. Ouvrez https://frederictriquet.github.io/proj-classe/ dans Chrome.
3. Cliquez sur le bouton « Installer » en haut à droite de la page, puis confirmez dans la fenêtre de Chrome.
4. Une fenêtre « Proj-Classe » s'ouvre et son icône apparaît dans le Dock. Clic droit sur l'icône du Dock, Options, Garder dans le Dock.

**V8** : réussi si l'installation aboutit. Si Chrome affiche un message de blocage par l'administrateur, notez-le mot pour mot. Si le navigateur n'est pas géré, notez « sans objet, Mac non géré ».

Si le bouton « Installer » n'apparaît pas, notez-le et passez par l'icône d'installation de la barre d'adresse de Chrome.

## Étape 2 : cache hors ligne et stockage (V7, V5)

Toute la suite se fait dans la fenêtre de l'application installée, jamais dans un onglet de Chrome.

1. Cliquez sur le lien « Diagnostic » en bas à droite de l'écran d'accueil.
2. Section « Application », ligne « Mode d'affichage » : elle doit indiquer « application installée (fenêtre autonome) ».
3. Notez la ligne « Version » (par exemple `0.1.0 (90e774b)`).

**V7** : réussi si la ligne « Cache hors ligne » indique « complet : N fichiers sur N » et si la ligne « Service worker » indique « actif », « contrôle cette page : oui » et « portée : https://frederictriquet.github.io/proj-classe/ ».

**V5** : réussi si la ligne « Stockage persistant » indique « accordé : persist() a répondu true ».

## Étape 3 : micro (V6, première partie de V1)

1. Section « Micro », cliquez sur « Essayer le micro ».
2. Chrome demande l'autorisation d'utiliser le micro : Autoriser. macOS peut aussi demander l'accès au micro pour Google Chrome : Autoriser.
3. Parlez : la valeur de la ligne « Niveau sonore » monte, puis redescend quand vous vous taisez.

**V6, première partie** : la ligne « Traitements audio (getSettings) » doit afficher `echoCancellation : false`, `noiseSuppression : false`, `autoGainControl : false` et « les trois traitements sont désactivés ».

**V6, stabilité** :

1. Créez un bruit constant à un mètre du Mac : ventilateur, ou bruit blanc joué par un téléphone à volume fixe.
2. Notez la valeur en dBFS de « Niveau sonore » au départ, puis après 30 secondes et après 60 secondes.
3. Parlez fort pendant 5 secondes, taisez-vous, et regardez combien de temps le niveau met à revenir à la valeur d'avant.

Critère que je propose : les trois relevés restent à moins de 3 dB l'un de l'autre, et après avoir parlé, le niveau revient à moins de 3 dB de la valeur d'avant en moins de 2 secondes. Un niveau qui dérive lentement, ou qui reste bas plusieurs secondes après le bruit, signale un gain automatique encore actif.

Cliquez sur « Arrêter le micro ».

## Étape 4 : autorisation micro conservée (V1)

1. Fermez la fenêtre Proj-Classe, puis quittez complètement Chrome (menu Chrome, Quitter Google Chrome).
2. Relancez Proj-Classe depuis le Dock, ouvrez « Diagnostic ».
3. Avant de cliquer sur quoi que ce soit, lisez la ligne « Autorisation micro ».
4. Cliquez sur « Essayer le micro ».

**V1** : réussi si « Autorisation micro » indique « accordée » et si aucune demande d'autorisation n'apparaît au clic. V1 est revérifié après la mise à jour (étape 5) et après le redémarrage (étape 6).

## Étape 5 : mise à jour sans action (V3)

1. Notez la ligne « Version ».
2. Fermez la fenêtre Proj-Classe et quittez Chrome.
3. Envoyez-moi « V3 prêt ». Je publie la version de test 0.1.1 et je vous réponds « 0.1.1 en ligne » une fois que je l'ai constatée sur le site.
4. Wi-Fi actif, lancez Proj-Classe depuis le Dock. Quelques secondes après le lancement, la page peut se recharger d'elle-même une fois : c'est la mise à jour qui s'applique.
5. Ouvrez « Diagnostic » et lisez la ligne « Version ».

**V3** : réussi si la version commence par `0.1.1` dès ce premier lancement. Si elle est encore en 0.1.0, attendez une minute fenêtre ouverte et relisez, puis fermez et relancez une fois : notez à quel moment la version a changé. Un changement au second lancement seulement compte comme un échec de V3.

**V1 après mise à jour** : relisez « Autorisation micro » et cliquez sur « Essayer le micro ». Notez s'il indique « accordée » et si une demande d'autorisation apparaît.

## Étape 6 : sans réseau, puis après redémarrage (V2)

1. Fermez la fenêtre Proj-Classe et quittez Chrome.
2. Coupez le Wi-Fi (icône Wi-Fi de la barre des menus). Débranchez aussi le câble réseau s'il y en a un.
3. Lancez Proj-Classe depuis le Dock : l'écran d'accueil vert doit s'afficher.
4. Ouvrez « Diagnostic » : « Réseau » doit indiquer « hors ligne » et « Cache hors ligne » « complet ». Section « Animation d'essai », cliquez sur « Lancer l'animation » : elle doit tourner.
5. Redémarrez le Mac (menu Pomme, Redémarrer). Après le redémarrage, vérifiez que le Wi-Fi est toujours coupé.
6. Lancez Proj-Classe et refaites le point 4.
7. Revérifiez V1 : « Autorisation micro », puis « Essayer le micro » (le micro fonctionne sans réseau).
8. Réactivez le Wi-Fi.

**V2** : réussi si l'accueil et le diagnostic s'affichent Wi-Fi coupé, avant et après le redémarrage, avec le cache complet et l'animation qui tourne.

## Étape 7 : vidéoprojecteur (V4, V9)

1. Branchez le vidéoprojecteur. Dans Réglages Système, Écrans, choisissez pour le projecteur le mode écran étendu, pas la recopie. Les libellés de macOS peuvent varier selon sa version.
2. Dans Réglages Système, Bureau et Dock, section Mission Control, notez si l'option qui donne des Spaces séparés à chaque écran est activée.
3. Dans Proj-Classe, ouvrez « Diagnostic ». Section « Écrans », la ligne « Bureau étendu » doit indiquer « oui ».
4. Cliquez sur « Détecter les écrans ». Chrome demande l'autorisation de gérer les fenêtres sur tous vos écrans : Autoriser. La ligne « Écrans détectés » doit lister deux écrans.
5. Cliquez sur « Ouvrir la fenêtre d'essai ».

Notez ce qui se passe :

- la fenêtre s'ouvre-t-elle sur le projecteur ou sur l'écran du Mac ?
- remplit-elle directement tout le projecteur, sans barre ni bord (plein écran) ?
- ou affiche-t-elle un grand bouton « Cliquer ici pour passer en plein écran » ? Dans ce cas, amenez le pointeur sur le projecteur, cliquez sur le bouton, et notez si le plein écran fonctionne ;
- pendant que le projecteur est en plein écran, l'écran du Mac reste-t-il visible et utilisable, avec la page de diagnostic lisible et cliquable ?

**V4** : réussi si la fenêtre d'essai occupe tout le projecteur sans clic sur le projecteur, et si l'écran du Mac reste utilisable. La ligne « Fenêtre d'essai sur l'autre écran » du Mac doit indiquer « plein écran : oui ».

**V9** : laissez l'animation tourner une minute sur le projecteur. Lisez le compteur en haut à gauche du projecteur (« … images/s · minimum … ») et la ligne « Fenêtre d'essai sur l'autre écran » sur le Mac. Réussi si le minimum est d'au moins 50.

6. Fenêtre d'essai toujours ouverte, cliquez sur « Copier le rapport » en haut de la page de diagnostic et collez ce premier rapport dans vos notes.
7. Fermez la fenêtre d'essai : cliquez dedans, touche Échap, puis fermez-la.

## Étape 8 : après effacement des données de Chrome (V10)

Cet essai passe en dernier : il efface l'application du disque et elle doit se rétablir seule.

Choisissez l'une des deux options et notez laquelle :

- **Option A, recommandée** : n'effacer que les données de l'application. Dans une fenêtre Chrome ordinaire, ouvrez `chrome://settings/content/all`, cherchez `frederictriquet.github.io` et supprimez ses données. Les autres sites ne sont pas touchés. Il est possible que cela réinitialise aussi l'autorisation micro du site (déduit, non vérifié).
- **Option B, fidèle au texte de V10** : effacement global. Ouvrez `chrome://settings/clearBrowserData`, période « Toutes les périodes », cochez les cookies et données des sites ainsi que les images et fichiers en cache, puis confirmez. Attention : cela déconnecte de tous les sites sur ce profil Chrome (messagerie, ENT…).

Ensuite :

1. Fermez toutes les fenêtres Chrome et Proj-Classe, quittez Chrome.
2. Notez si l'icône Proj-Classe est toujours dans le Dock.
3. Wi-Fi actif, lancez Proj-Classe. Notez si l'accueil s'affiche.
4. Ouvrez « Diagnostic » et attendez que « Cache hors ligne » indique « complet » et que « Service worker » indique « contrôle cette page : oui ». Si ce n'est pas le cas après 30 secondes, fermez, relancez une fois et notez-le.
5. Notez la ligne « Autorisation micro ».
6. Cliquez sur « Copier le rapport » et collez ce second rapport dans vos notes.
7. Fermez Proj-Classe, quittez Chrome, coupez le Wi-Fi, relancez Proj-Classe : l'accueil puis le diagnostic doivent s'afficher, cache complet.
8. Réactivez le Wi-Fi.

**V10** : réussi si l'application se rétablit au premier lancement avec réseau (cache complet, page contrôlée), puis démarre Wi-Fi coupé.

## Résultats à m'envoyer

Recopiez ce modèle, complétez chaque ligne, et joignez les deux rapports copiés :

```
Date des essais :
Mac (modèle, version de macOS) :
Chrome (ligne « Navigateur ») :
V1 : réussi / échec : …
V2 : réussi / échec : …
V3 : réussi / échec : version avant, version après, à quel lancement
V4 : réussi / échec : écran d'ouverture, plein écran direct ou après clic, écran du Mac utilisable, option Spaces séparés
V5 : réussi / échec : …
V6 : réussi / échec : relevés à 0, 30 et 60 s, retour après la parole
V7 : réussi / échec : …
V8 : réussi / échec / sans objet : …
V9 : réussi / échec : minimum relevé, résolution du projecteur
V10 : réussi / échec : option A ou B, icône du Dock, autorisation micro après effacement
```

Si une ligne du diagnostic s'affiche en rouge à n'importe quel moment, copiez le rapport à ce moment-là et joignez-le.
