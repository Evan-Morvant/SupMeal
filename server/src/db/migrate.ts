import { sequelize } from '../config/database';
import { migrator } from './migrator';

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'up';

  switch (command) {
    case 'up': {
      const migrations = await migrator.up();
      console.log(
        migrations.length
          ? migrations.length + ' migration(s) appliquée(s).'
          : 'Aucune migration en attente.',
      );
      break;
    }
    case 'down': {
      const migrations = await migrator.down();
      console.log(migrations.length + ' migration(s) annulée(s).');
      break;
    }
    case 'status': {  
      const executed = await migrator.executed();
      const pending = await migrator.pending();
      console.log('Appliquées :', executed.map((m) => m.name));
      console.log('En attente  :', pending.map((m) => m.name));
      break;
    }
    default:
      console.error('Commande inconnue « ' + command + ' » (attendu : up | down | status)');
      process.exitCode = 1;
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error('Échec de la migration :', err);
  process.exit(1);
});
