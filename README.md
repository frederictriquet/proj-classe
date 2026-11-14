# Proj-Classe

Application de classe installable depuis Chrome (PWA), publiée sur GitHub Pages à chaque push sur `master` : https://frederictriquet.github.io/proj-classe/

Les décisions sont dans `docs/SPEC.md`, la validation sur le Mac de l'enseignante dans `docs/VALIDATION.md`.

## Retour arrière

Procédure à suivre quand une version publiée est défectueuse (SPEC-3.9.4).

1. Repérer le commit fautif :

   ```sh
   git switch master
   git pull
   git log --oneline
   ```

2. L'annuler par un nouveau commit, sans réécrire l'historique :

   ```sh
   git revert --no-edit <hash>
   ```

   Pour annuler plusieurs commits consécutifs : `git revert --no-edit <plus-ancien>^..<plus-récent>`. En cas de conflit, corriger les fichiers, `git add`, puis `git revert --continue`.

3. Vérifier en local que la version rétablie démarre :

   ```sh
   npm ci
   npm test
   npm run build
   npm run test:startup
   ```

4. Pousser :

   ```sh
   git push origin master
   ```

5. Suivre le workflow « Deploy to GitHub Pages » (`gh run watch`, ou l'onglet Actions du dépôt). Le test de démarrage tourne avant la publication : s'il échoue, rien n'est publié et la version en ligne reste celle d'avant.

L'application installée prend la version rétablie au lancement suivant avec réseau. Si elle affiche l'écran « L'application a rencontré un problème », la version rétablie s'installe et la page se recharge pendant ce même lancement.

Limite (SPEC-3.9.5) : sans réseau, une version défectueuse déjà installée reste en place jusqu'au prochain lancement avec réseau. Aucune copie de la version précédente n'est conservée sur le Mac.
