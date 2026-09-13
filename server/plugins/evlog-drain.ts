import { createFsDrain } from 'evlog/fs'

// Nitro-плагин: второе адресат для широких событий evlog — .evlog/logs/<дата>.jsonl
// (файл на день, один JSON на строку). stdout остаётся как есть, его собирает Dokploy;
// файл нужен, чтобы разбирать случай задним числом, когда терминал `pnpm dev` уже закрыт:
// навык `analyze-logs` читает именно .evlog/logs/, а grep/jq по requestId работают без
// живого процесса.
//
// Ротация обязательна: в прод-контейнере //app — writable layer образа, его размер
// не безразмерен. 7 файлов по 10 МБ = потолок ~70 МБ, самое старое адаптер удаляет сам
// после каждой записи.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('evlog:drain', createFsDrain({
    maxFiles: 7,
    maxSizePerFile: 10 * 1024 * 1024,
  }))
})
