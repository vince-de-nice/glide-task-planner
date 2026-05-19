# Mettre l’application en ligne sur un site web

Ce guide est écrit pour une personne **qui n’est pas informaticienne**. L’objectif est que l’application **VAV — Déclaration FLARM** soit visible dans un navigateur (Chrome, Firefox, Safari, Edge) à partir d’une adresse du type `https://votre-domaine.fr`.

---

## En deux phrases : qu’est-ce qu’on fait ?

1. On **prépare** une fois les fichiers de l’application sur un ordinateur (étape « construction »).
2. On **copie** ces fichiers sur l’espace web fourni par votre hébergeur (comme on met des documents dans un dossier partagé), à l’endroit où le public voit votre site.

**Bonne nouvelle :** une fois en ligne, l’application tourne **dans le navigateur** des visiteurs. Vous n’avez **pas besoin** d’une base de données ni de PHP sur le serveur pour que ça fonctionne.

---

## Partie A — Obtenir les fichiers à mettre en ligne

Vous avez **deux façons** d’obtenir le bon dossier. Choisissez celle qui vous correspond.

### Option 1 — Quelqu’un de technique le fait pour vous (recommandé si vous n’avez pas l’habitude)

Demandez à la personne qui gère le projet d’exécuter sur l’ordinateur du projet :

```bash
npm install
npm run build
```

Ensuite, elle doit vous envoyer une **archive ZIP** du contenu du dossier suivant (tout ce qu’il y a **à l’intérieur**, pas seulement le nom du dossier) :

**`dist/vav-angular/browser`**

C’est ce ZIP que vous décompresserez et placerez sur votre hébergement (voir Partie B).

### Option 2 — Vous le faites vous-même sur votre ordinateur

1. **Installer Node.js** (version 18 ou plus récente) depuis le site officiel : [https://nodejs.org](https://nodejs.org)  
   - Pendant l’installation, laissez les options par défaut ; cela installe aussi **npm** (le gestionnaire de paquets).

2. **Ouvrir un terminal** (invite de commandes) :
   - Sur Windows : menu Démarrer → taper « Terminal » ou « PowerShell ».
   - Sur Mac : Applications → Utilitaires → Terminal.

3. **Aller dans le dossier du projet** avec la commande `cd` (change directory), en adaptant le chemin à votre machine, par exemple :

   ```bash
   cd chemin/vers/vav-angular
   ```

4. **Installer les dépendances** (une seule fois, ou après une mise à jour du projet) :

   ```bash
   npm install
   ```

5. **Construire la version « production »** (les fichiers optimisés pour le web) :

   ```bash
   npm run build
   ```

6. Sur votre disque, ouvrez le dossier du projet puis :

   **`dist` → `vav-angular` → `browser`**

   Tout ce qui se trouve **dans** `browser` (fichiers et sous-dossiers comme `assets`, `config`, `index.html`, fichiers `.js`, `.css`, etc.) est ce que vous devez mettre sur le site web.

---

## Partie B — Mettre ces fichiers sur votre hébergement

Le principe est **toujours le même** : le fichier **`index.html`** doit se retrouver à la **racine du site** que les visiteurs consultent (souvent un dossier nommé `www`, `public_html`, `htdocs` ou `httpdocs` selon les hébergeurs).

### Ce que vous uploadez

- Uploadez **le contenu** du dossier `browser` (pas le dossier `dist` entier).
- Après l’upload, en ouvrant le dossier du site sur le serveur, vous devez **voir** `index.html` directement à côté des dossiers `assets`, etc.

### Comment uploader (selon votre type d’hébergement)

| Type d’hébergement | En pratique (vocabulaire simple) |
|--------------------|-----------------------------------|
| **Hébergement classique** (OVH, Ionos, o2switch, LWS, hébergeur d’association, etc.) | Connectez-vous à l’**espace client**, ouvrez le **gestionnaire de fichiers** ou utilisez un logiciel **FTP** (FileZilla est courant). Repérez le dossier du site (`www`, `public_html`, …). Glissez-déposez ou copiez tous les fichiers issus de `browser`. |
| **cPanel** | Fichiers → `public_html` (ou sous-dossier d’un sous-domaine) → Envoyer / Uploader les fichiers. |
| **Netlify, Vercel, Cloudflare Pages** | Souvent : créer un site, puis **glisser-déposer** le dossier `browser` dans la zone indiquée, ou lier un dépôt Git si votre équipe utilise Git. |
| **GitHub Pages** | En général la personne technique configure le dépôt ; le contenu servi est celui de la branche/dossier configuré. Les fichiers finaux restent ceux du dossier `browser`. |

Si vous hébergez dans un **sous-dossier** du site (ex. `monsite.fr/app/`) et non à la racine, il faudra peut-être adapter la configuration (`base href`) : dans ce cas, faites-vous aider par la personne qui construit le projet.

---

## Partie C — Règle importante pour les adresses (pages « Déclaration », « Waypoints »)

Sur la page **Déclaration**, le parcours pilote suit trois étapes affichées en haut : **Base** (fichier CUP), **Circuit** (points et ordre), **Export** (téléchargement `flarmcfg.txt`).

L’application utilise des **adresses dans la barre d’URL** (par exemple `/declaration`). Si un visiteur met un favori sur une telle adresse ou actualise la page, le serveur doit **renvoyer la même application** et non une page « 404 introuvable ».

Sur un hébergement **statique** moderne (Netlify, Vercel, Cloudflare Pages, etc.), c’est souvent **automatique**.

Sur un **hébergement Apache** (très courant), il faut un petit fichier **`.htaccess`** à la racine du site (là où se trouve `index.html`), avec une règle du type : « si le fichier demandé n’existe pas, afficher `index.html` ». Demandez à votre hébergeur la phrase exacte à mettre ou à la personne technique de l’ajouter ; c’est une configuration standard pour les applications de ce type.

**Exemple** (à enregistrer sous le nom `.htaccess`, même dossier que `index.html`) si votre hébergeur autorise ce fichier et le module *rewrite* :

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

Si le site est dans un sous-dossier (ex. `/app/`), remplacez `RewriteBase /` par `RewriteBase /app/` et la dernière ligne par `RewriteRule . /app/index.html [L]` — en cas de doute, mieux vaut l’aide d’une personne habituée à Apache.

Sur **nginx**, la même idée se configure dans le panneau du serveur ou par un fichier de configuration ; là encore, l’hébergeur ou la personne technique peut le faire en quelques minutes.

---

## Vérifier que tout fonctionne

1. Ouvrez votre site avec **`https://`** (connexion sécurisée), si votre hébergeur le propose (c’est recommandé).
2. La page d’accueil de l’application doit s’afficher.
3. Naviguez entre les sections ; rechargez la page sur une sous-adresse : l’application doit toujours s’afficher.

---

## Mises à jour ultérieures

Quand le projet change :

1. Reconstruire les fichiers (`npm run build` ou recevoir un nouveau ZIP du dossier `browser`).
2. **Remplacer** sur le serveur les anciens fichiers par les nouveaux (même emplacement).  
   Attention : certains fichiers ont des noms avec des lettres et chiffres qui changent à chaque build ; il vaut mieux **supprimer l’ancienne version** du dossier du site puis **tout re-uploader**, pour éviter de mélanger d’anciens et de nouveaux fichiers JavaScript.

---

## Récapitulatif

| Étape | Action |
|--------|--------|
| 1 | `npm install` puis `npm run build` (ou recevoir le ZIP du contenu de `browser`) |
| 2 | Placer le contenu de **`dist/vav-angular/browser`** à la racine web (là où est `index.html` pour les visiteurs) |
| 3 | Configurer la redirection « SPA » si nécessaire (Apache `.htaccess` ou équivalent) |
| 4 | Tester en HTTPS et en rechargeant une sous-page |

Si un point bloque (FTP, erreur 404, sous-dossier), notez **le nom de votre hébergeur** et **l’URL exacte** où vous avez mis les fichiers : la personne technique pourra vous dire la manipulation précise dans leur interface.
