import { Link } from 'react-router-dom';
import styles from './TermsPage.module.css';

/*
 * Conditions d'utilisation. Elles décrivent ce que l'application fait
 * réellement — visibilité des recettes, rôles des cookbooks, sort des données —
 * plutôt que des clauses de circonstance : des conditions qu'on ne peut pas
 * relier au produit ne renseignent personne.
 */
export function TermsPage(): JSX.Element {
  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <h1>Conditions générales d'utilisation</h1>
        <p className={styles.updated}>En vigueur depuis le 18 août 2026.</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Objet</h2>
        <p>
          SUPMEAL est un service de gestion de recettes et de planification de repas. Il permet
          d'enregistrer des recettes, de les rassembler dans des carnets partagés appelés
          cookbooks, de planifier des repas et d'en déduire une liste de courses. Créer un compte
          vaut acceptation des présentes conditions.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Votre compte</h2>
        <p>
          Un compte s'ouvre avec une adresse e-mail et un mot de passe, ou en passant par Google
          ou GitHub. Votre mot de passe n'est jamais conservé en clair. Vous répondez de l'usage
          fait de votre compte : gardez vos identifiants pour vous, et signalez-nous toute
          utilisation que vous n'auriez pas autorisée.
        </p>
        <p>
          Changer de mot de passe ferme vos autres sessions. Vous pouvez lier ou délier un compte
          Google ou GitHub à tout moment depuis vos paramètres.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Vos recettes restent les vôtres</h2>
        <p>
          Vous conservez tous vos droits sur les recettes, textes et photos que vous déposez.
          Nous ne les revendiquons pas et ne les exploitons pas ailleurs que dans le service.
        </p>
        <ul className={styles.list}>
          <li>
            Une recette est <strong>privée par défaut</strong> : vous seul la voyez, ainsi que les
            membres des cookbooks où vous la rangez.
          </li>
          <li>
            La passer en <strong>publique</strong> la rend consultable par tout le monde, compte
            ou non, y compris ses tags — un tag écrit librement peut contenir un prénom.
          </li>
          <li>
            La retirer d'un cookbook ne la supprime pas ; la supprimer efface en revanche les
            commentaires et les avis qui s'y rattachaient.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>4. Ce que vous partagez dans un cookbook</h2>
        <p>
          Un cookbook réunit des membres, chacun avec un rôle : lecteur, commentateur, éditeur ou
          créateur. Les commentaires et les discussions d'un cookbook sont visibles de ses
          membres, et d'eux seuls.
        </p>
        <p>
          Ranger une recette dans un cookbook, c'est accepter que ses éditeurs la corrigent. Le
          créateur du cookbook peut supprimer un commentaire au titre de la modération de son
          groupe, sans jamais pouvoir le réécrire.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>5. Avis publics</h2>
        <p>
          Un avis est public et vous n'en déposez qu'un par recette ; vous pouvez le modifier ou
          le retirer à tout moment. On ne note pas sa propre recette. Les avis servent à
          renseigner, pas à blesser : les propos injurieux, diffamatoires ou hors sujet n'y ont
          pas leur place.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>6. Recettes et sécurité alimentaire</h2>
        <p className={styles.warning}>
          Les recettes sont écrites par les utilisateurs. Ni leur exactitude, ni la liste complète
          de leurs allergènes ne peuvent être garanties. Les préférences alimentaires que vous
          déclarez servent à vous proposer des recettes, jamais à certifier qu'un plat vous
          convient : en cas d'allergie ou d'intolérance, vérifiez vous-même les ingrédients.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>7. Vos données</h2>
        <p>
          Nous n'exploitons vos données ni à des fins publicitaires, ni par revente à des tiers.
          Depuis vos paramètres, vous pouvez à tout moment :
        </p>
        <ul className={styles.list}>
          <li>exporter vos recettes et vos cookbooks, en JSON, CSV ou au format Mealie ;</li>
          <li>
            télécharger l'ensemble de vos données personnelles — profil, préférences, adhésions,
            favoris, avis, commentaires, messages, planning et listes.
          </li>
        </ul>
        <p>
          Un fichier d'export contient vos recettes <strong>en clair</strong> et se lit sans
          compte : ne le transmettez qu'à qui vous entendez le confier.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>8. Usages interdits</h2>
        <p>
          Sont notamment exclus : déposer un contenu dont vous n'avez pas les droits, usurper
          l'identité d'un tiers, tenter d'accéder aux contenus privés d'autrui, ou perturber le
          fonctionnement du service. Un compte qui contreviendrait à ces règles peut être
          suspendu.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>9. Évolution des conditions</h2>
        <p>
          Ces conditions peuvent changer, notamment si le service évolue. La date en tête de page
          indique la version en vigueur. Un changement notable vous sera signalé dans
          l'application.
        </p>
      </section>
        <p>
          <Link to="/register">Créer un compte</Link> ·{' '}
          <Link to="/discover">Parcourir les recettes publiques</Link>
        </p>
    </article>
  );
}
