import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { errorMessage } from '../../api/errors';
import type { ExportFormat, ImportResult } from '../../api/types';
import { downloadFromApi } from '../../lib/download';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Field';
import { Alert } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import styles from './Settings.module.css';

/** Repli si le serveur ne dit pas le nom du fichier. */
const EXTENSIONS: Record<ExportFormat, string> = { json: 'json', csv: 'csv', mealie: 'json' };

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'json', label: 'JSON — le plus complet, à privilégier pour restaurer' },
  { value: 'csv', label: 'CSV — une recette par ligne, pour un tableur' },
  { value: 'mealie', label: 'Mealie — pour importer ailleurs' },
];

export function DataTab(): JSX.Element {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<ExportFormat>('json');
  const [failure, setFailure] = useState<string | null>(null);
  const [report, setReport] = useState<ImportResult | null>(null);

  const exportRecipes = useMutation({
    mutationFn: () =>
      // Le format Mealie produit du JSON : son nom n'est pas son extension.
      downloadFromApi('/export', 'supmeal-export.' + EXTENSIONS[format], { format }),
    onError: (error) => setFailure(errorMessage(error)),
  });

  const exportPersonal = useMutation({
    mutationFn: () => downloadFromApi('/users/me/data', 'supmeal-donnees.json'),
    onError: (error) => setFailure(errorMessage(error)),
  });

  const importRecipes = useMutation({
    mutationFn: async (file: File): Promise<ImportResult> => {
      const body = new FormData();
      body.append('file', file);
      const { data } = await api.post<ImportResult>('/import', body);
      return data;
    },
    onSuccess: (result) => {
      setReport(result);
      setFailure(null);
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
    onError: (error) => setFailure(errorMessage(error)),
  });

  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Exporter mes recettes</h2>

        {/* Avertissement exigé au cahier des charges, avant le téléchargement. */}
        <Alert tone="warning">
          Le fichier produit contient vos recettes <strong>en clair</strong>. Il se lit sans
          compte : ne le transmettez qu'à qui vous voulez le confier.
        </Alert>

        <p className={styles.note}>
          Périmètre : vos recettes et celles des cookbooks dont vous êtes membre. Ni votre
          identité ni vos préférences n'y figurent — elles sortent par la portabilité, plus bas.
        </p>

        <div className={styles.formats}>
          <Select
            className={styles.formatSelect}
            value={format}
            aria-label="Format d'export"
            onChange={(event) => setFormat(event.target.value as ExportFormat)}
          >
            {FORMATS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Button loading={exportRecipes.isPending} onClick={() => exportRecipes.mutate()}>
            <Icon name="telecharger" size={20} />
            Télécharger
          </Button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Importer un fichier</h2>
        <p className={styles.note}>
          JSON, CSV ou Mealie — le format est deviné du contenu. Vous devenez le créateur des
          recettes importées, créées <strong>privées</strong> quelle que soit leur visibilité
          d'origine. Une recette dont vous possédez déjà le titre est ignorée.
        </p>

        <input
          ref={fileRef}
          className={styles.file}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) {
              importRecipes.mutate(file);
            }
          }}
        />
        <div className={styles.formats}>
          <Button
            variant="outline"
            loading={importRecipes.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="importer" size={20} />
            Choisir un fichier
          </Button>
        </div>

        {report !== null && (
          <div className={styles.report}>
            <div className={styles.counts}>
              <span className={styles.count}>
                <span className={styles.countValue}>{report.created}</span>
                <span className={styles.countLabel}>créées</span>
              </span>
              <span className={styles.count}>
                <span className={styles.countValue}>{report.skipped}</span>
                <span className={styles.countLabel}>ignorées</span>
              </span>
              <span className={styles.count}>
                <span className={styles.countValue}>{report.errors.length}</span>
                <span className={styles.countLabel}>en échec</span>
              </span>
            </div>
            {/* Une recette invalide n'interrompt pas le reste : on la nomme. */}
            {report.errors.length > 0 && (
              <ul className={styles.errors}>
                {report.errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Mes données personnelles</h2>
        <p className={styles.note}>
          Profil, préférences, comptes liés, adhésions, favoris, avis, commentaires, messages,
          planning et listes. Ce fichier décrit une personne : il ne se réimporte pas, et ne
          contient ni mot de passe ni jeton. Le contenu de vos recettes s'obtient par l'export
          ci-dessus.
        </p>
        <div className={styles.formats}>
          <Button
            variant="outline"
            loading={exportPersonal.isPending}
            onClick={() => exportPersonal.mutate()}
          >
            <Icon name="telecharger" size={20} />
            Télécharger mes données
          </Button>
        </div>
      </section>

      {failure !== null && <Alert>{failure}</Alert>}
    </>
  );
}
