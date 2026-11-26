# Renqd â€” Stato dell'arte

> **Documento operativo:** aggiornare questo file dopo ogni gruppo significativo di modifiche.
>
> Per le decisioni vincolanti consultare prima `PROJECT_DECISIONS.md`. Se questo documento descrive uno stato tecnico che contraddice una decisione, prevale `PROJECT_DECISIONS.md`.
>
> **Aggiornato:** 26 novembre 2026
> **Repository:** https://github.com/opidevelop/renqd
> **Branch operativo:** `main`
> **Ultimo commit applicativo analizzato su main:** `e7f2942bcc9980669397f7577ee7aa135c3dc860`

## 1. Sintesi esecutiva

- Il progetto Ã¨ sviluppato con Next.js App Router, React, TypeScript strict, Supabase e Vercel.
- Il lavoro viene svolto esclusivamente su `main`.
- Renqd Ã¨ una piattaforma chiusa: le pagine e i contenuti interni richiedono autenticazione e approvazione quando prevista.
- Le fasi di amministrazione, lifecycle dei dati, motore Renq e profilo/cataloghi/collezioni hanno ricevuto implementazioni sostanziali. La verifica funzionale end-to-end complessiva Ã¨ ancora da eseguire.
- Verifiche locali aggiornate al 23 novembre: TypeScript, ESLint e Production Build superati sul commit pubblicato e ripetuti dopo l'hardening della cancellazione account. ESLint mantiene warning preesistenti non bloccanti; la Edge Function Ã¨ stata verificata anche con `deno check`.
- **Produzione Vercel:** `renqd.app` Ã¨ associato al deployment Production `READY` del commit `162f3749f65ebc55f2ac32c13db083f9af0c1be6` (23 novembre 2026). Non Ã¨ stato creato un ulteri¶»§q«^u¤èÉ•¹Å‘}É•…Ñ•}É…¹­¥¹}İ¥Ñ¡}¥Ñ•µÍ€”É•¹Å‘}½µÁ±•Ñ•}É…¹­¥¹€¡…¹¹¼½µÁ±•Ñ…Ñ¼½ÉÉ•ÑÑ…µ•¹Ñ”¥°I•¹Äì¥°É¥ÍÕ±Ñ…Ñ¼¥¹±Õ‘”±„Á½Í¥é¥½¹”€ÄÀÄ¸QÉ…¹Í…é¥½¹”…¹¹Õ±±…Ñ„½¸I=11	-€”Ù•É¥™¥„ÍÕ•ÍÍ¥Ù„èé•É¼É…¹­¥¹œ‘¤Ñ•ÍĞÁ•ÉÍ¥ÍÑ•¹Ñ¤¸(´¥Ñ!ÕˆÑ¥½¹Ì½‘”ÅÕ…±¥ÑäÉÕ¸€¨¨ŒÄÄØ€¼€ĞĞÌàäĞÜàÜØÌ¨¨ÍÕ°½µµ¥Ğ€Ù‰„àÄİ‘ŒÌÜÈÅŒäÅ‘„ØØØÔÔÀÀÉˆÑ•…„àÉ”ÌÁŒäİ€è€¨©ÍÕ•ÍÌ¨¨ìQåÁ•MÉ¥ÁĞ°M1¥¹Ğ”‰Õ¥±‘¤ÁÉ½‘Õé¥½¹”ÍÕÁ•É…Ñ¤¸(´¥Ñ!ÕˆÑ¥½¹Ì½‘”ÅÕ…±¥ÑäÉÕ¸€¨¨ŒÄÈÀ€¼€ĞĞÌäÀÔĞÈÈÔÌ¨¨ÍÕ°½µµ¥Ğ…ÁÁ±¥…Ñ¥Ù¼™¥¹…±”€ØÈÈÍ„Ôİ”Å˜àÈààÀåˆĞÉÌÜİ„ÀäÔàÔàÌÅ™„ÔÔÄäàå€è€¨©ÍÕ•ÍÌ¨¨ìQåÁ•MÉ¥ÁĞ°M1¥¹Ğ”‰Õ¥±‘¤ÁÉ½‘Õé¥½¹”ÍÕÁ•É…Ñ¤¸(´%°½µµ¥Ğ‘¤É¥…±±¥¹•…µ•¹Ñ¼‘•°¹½µ”™¥±”µ¥É…é¥½¹”ƒ €ÀÉ‘”äØĞÄÔÙå˜ØÉ••…„Ù”äÙ˜ÌÁˆÔÔÅÙ…„äÁŒÙ™•€ì¥Ñ!ÕˆÑ¥½¹Ì½‘”ÅÕ…±¥ÑäÉÕ¸€¨¨ŒÄÄÜ€¼€ĞĞÌàäÔàäÔÜÔ¨¨è€¨©ÍÕ•ÍÌ¨¨¸%°ÍÕ•ÍÍ¥Ù¼…¥½É¹…µ•¹Ñ¼‘½Õµ•¹Ñ…±”ƒ €Ù˜Àå˜ÈÜÉ‘ÔÜİ˜àÀİ•”ĞÔÜÑ‘˜àÌÁäÍÜäÅ™‰„Á€ìÉÕ¸€¨¨ŒÄÄà€¼€ĞĞÌàäààäàÀà¨¨è€¨©ÍÕ•ÍÌ¨¨¸(´Y•É•°AÉ½‘ÕÑ¥½¸‘•Á±½åµ•¹Ğ…ÁÁ±¥…Ñ¥Ù¼™¥¹…±”‘Á±|ÉI9a5½ÍİAQ™Í™U‰µLØÙÜİÉå•4Õ€è€¨©Id¨¨°½µµ¥Ğ€ØÈÈÍ„Ôİ”Å˜àÈààÀåˆĞÉÌÜİ„ÀäÔàÔàÌÅ™„ÔÔÄäàå€ì…±¥…ÌÉ•¹Å¹…ÁÁ€°É•¹Å¹Ù•É•°¹…ÁÁ€”İİÜ¹É•¹Å¹…ÁÁ€…ÍÍ½¥…Ñ¤¸(´Q•ÍĞ™Õ¹é¥½¹…±”‘…°‰É½İÍ•È…ÕÑ•¹Ñ¥…Ñ¼Á•È±„É•…é¥½¹””±„ÁÕ‰‰±¥…é¥½¹”‘¤I•¹Ä½¸½±ÑÉ”€ÄÀÀ•±•µ•¹Ñ¤É•ÍÑ„‘„•Í•Õ¥É”¸%°Ñ•ÍĞME0Ù•É¥™¥„±„IA”¥°‘…Ñ…‰…Í”°µ„¹½¸Í½ÍÑ¥ÑÕ¥Í”¥°½±±…Õ‘¼U$•¹µÑ¼µ•¹¸(((ŒŒ€ÄÜ¸½ÉÉ•é¥½¹”¥¹Í•É¥µ•¹Ñ¼‘•¥µ…±¤¥¸É…‘”ƒŠP€Äà¹½Ù•µ‰É”€ÈÀÈØ((ŒŒŒAÉ½‰±•µ„(´ÕÉ…¹Ñ”±„Ù…±ÕÑ…é¥½¹”¥¹¥é¥…±”°¥°ÁÉ¥µ¼…É…ÑÑ•É”¹Õµ•É¥¼Ù…±¥‘¼€¡…•ÎÚîÆ­yÒ'V–ÆBà¢Ò–Â6öÆÆVFò'&÷w6W"&W7F&–çf–FòÆÆ6W76–öæRf–æÆRVæ–6&–6†–W7FFÆÂwWFVçFRà¢Òv—D‡V"7F–öç2¢¢3#s¢¢†vv–÷&æÖVçFòFö7VÖVçFÆR&V6VFVçFR“¢7V66W72à ¢22Câ7VvvW&–ÖVçF’66÷&’&6F’æ6†R7VÆÂvGF—f—L:&V6VçFR(	B’æ÷fVÖ'&R##` ¢ÒW7FW6ò–ÂVçFVvv–òF’&66öÖæF¦–öæRWFVçF’F’66÷&“¢öÇG&RföÆÆ÷vW"–â6ö×VæRÂföÆÆ÷vW"F÷FÆ’R6FVv÷&–RF’&æ¶–ær6öæF—f—6RÂ6öç6–FW&÷&ÆRGF—f—L:V&&Æ–6†RFVvÆ’VÇF–Ö’3v–÷&æ’à¢Ò–Â6öçG&–'WFòFVÆÂvGF—f—L:&V6VçFR:‚Æ–Ö—FFòRVçF’ÂW"Wf—F&R6†RVâföÇVÖRVÆWfFòF’WfVçF’FöÖ–æ’vÆ’ÇG&’6VvæÆ’à¢ÒÆRGF—f—L:6öç6–FW&FR6öæòVVÆÆR&Vv—7G&FR–â&æ¶–æuö7F—f—G–²–ÂfVVBRÆR&66öÖæF¦–öæ’6öçF–çVæò&—7WGF&Rf—6–&–Æ—L:V&&Æ–6R&—f7’à¢ÒÖ–w&¦–öæRÆ–6FR&W6VçFR7RÖ–æ¢##c“3#sC…÷&VçE÷6ö6–ÅöF—66÷fW'•ö7F—f—G•÷vV–v‡Fà¢ÒF÷FÆRÖ–w&¦–öæ“¢¢£“"æVÂ&W÷6—F÷'’R“"7R7W&6R¢¢ÂfW'6–öæ’RæöÖ’ÆÆ–æVF’à¢ÒfW&–f–65ÂFVÆÆ%2F’66÷&’6ö×ÆWFF6öâ66÷VçB&÷fFòà¢Òv—D‡V"7F–öç2¢¢3#s¢¢†6öçFF÷&’–æ&÷‚’Â¢¢3#s"¢¢R¢¢3#s2¢¢†Fö7VÖVçF¦–öæR“¢7V66W72à¢Òv—D‡V"7F–öç2¢¢3#sB¢¢7VÂ6öÖÖ—Bv3ƒs–F#s“S“F3ƒsFCSS–V3&3cC3FFSC3f¢–âGFW6F’6ö×ÆWFÖVçFòà¢ÒæW77VâFWÆ÷’&öGV7F–öã²–Â6öÆÆVFòVæB×FòÖVæB&W7FæVÆÆ6W76–öæRf–æÆRVæ–6à  ¢22C"â&–f–æ—GW&æf–v¦–öæRÂ66÷&’RæçVÆÆÖVçFò&Vç(	B’æ÷fVÖ'&R##` ¢222æf–v¦–öæRR67&öÆÀ¢Ò6W&FÆæf–v¦–öæRFW6·F÷FVVÆÆÖö&–ÆS¢Æ6–FV&"FW6·F÷ÖçF–VæR†öÖRÂ66÷&’Â7&VÂ&VëkºwµçH[]H™\İH[š\ÚXš[HH›Ûˆš[˜HH[X›˜Z[‚‹H
Š”š\™[™H™[œNŠŠˆ]X[™È[˜H›Ş˜HH[˜ÚH[˜HÙ\ÜÚ[Û™H][\^Y\ˆ]]˜KHØ\™[HÙ\ÜÚ[Û™HH™XÙY[˜Hİ[HØ\™›Ş˜KÛÜğë[ÛÛYØ[Y[ÈÜH[HØ˜HH›Ûˆ[	ÙY]ÜˆHÜ™X^š[Û™K‚‹H
Š“[Ù[ŠŠˆ›ÛİÚ[™ËÛÛ™™\›YHÛØ˜[HHÛÛ™™\›XH0ªÔİ[İH]ğ®È™[™ÛÛ›È™[™\š^˜]H\™][Y[H[ˆØİ[Y[˜›ÙH˜[Z]HÜ[ÛÜğë›Ûˆ™\İ[›È[˜\Û]H™YÛHİXÚÚ[™ÈÛÛ^H™YÛHİ™\™›İÈ[HYÚ[˜K‚‹H™\šYšXÚHØØ[NˆÚ]Y™ˆKXÚXÚËœH[ˆ[œØÈK[›Ñ[Z]HœH[ˆZ[İ\\˜]KˆTÓ[ÙYÛ˜[HØ\›š[™È›Ûˆ›ØØØ[H™Y\Ú\İ[K‚‹H™\Üİ[˜H[ÙYšXØHHØÚ[XHİ\X˜\ÙKZYÜ˜^š[ÛšK[ÛK\›Y\ÜÚHÈ]Kˆ\İš\İX[H]][XØ]È›Ûˆ\ÙYİZ]È[ˆ]Y\İHÙ\ÜÚ[Û™K‚‚‚ˆÈÈŒ‹LLKL8 %[İ™HšXÚY\İHRHHYÙÚ[Ü›˜[Y[È[H™YÛÛHÜ\˜]]™B‚ˆÈÈÈXÚ\Ú[ÛšHH™Y™\™[™HÛÛ™™\›X]H[	İ][B‹H
ŠØ\™™[œHX˜›XØ]ÎŠŠˆ[™]šYX\™H[šY™\š[Y[ÈÛÜœ™]È˜[Z]HHÜ›Û›ÛÙÚXHÚ]Ù[˜HÚYY\™H[	İ][HHØÙYÛY\™H[ˆÛÛ[Z]ÚH›ÛˆÛÛ›ÜØÙNÈš\š\İ[˜\™H™Y[Y[HHÜ˜YšXØHHšY™\š[Y[Ë‚‹H
ŠØ\™Ø˜H][\^Y\ŠŠˆ[šY›Ü›X\™HH™\Ù[^š[Û™H[HØ\™ZH™[œHX˜›XØ]KX[[™[™ÈH[š[Û˜[]0è][\^Y\ˆÚpè\›İ˜]HHHÛÜ\[˜HÛÛ[]H™[š\]XY›Ë‚‹H
Š‘[[˜ÚH\[NŠŠˆÛÛ\Ü[Y[Èİ[™\™šXÚY\İÈH\›İ˜]Îˆ[[˜ÚH[]KÛ[Y\˜]HZH[Ø[KÛÛ[X^š[Û™H]]ÛX]XØHÛÛˆ[š[ËÜ[È[š[È\ˆ\ØÚ\™KX‹ÔÚY
ÕXˆ\ˆÙ\İ\™HH]™[K‚‹H
Š]]š]0èŠŠˆ-®éÜj×ato senza attendere la risposta server. Il campo resta utilizzabile anche mentre le registrazioni precedenti sono in corso.
- La risposta server resta autorevole; gli errori applicativi o di connessione annullano la relativa scoperta provvisoria. La coda continua con gli elementi successivi.

### Correzione persistenza Solo â€” modalitÃ  Illimitata
- Causa individuata nella RPC `renqd_pokemon_name_em_all_submit_answer`: il controllo della scadenza trattava sempre `deadline_at IS NULL` come tempo scaduto, anche quando `duration_seconds=0` indicava una partita Illimitata.
- Corretta la condizione: la verifica di `deadline_at` si applica soltanto alle sessioni con durata diversa da zero.
- Migrazione Supabase applicata: `20261126080249_fix_name_em_all_solo_unlimited_answer_registration`.
- Migrazione versionata in `supabase/migrations/20261126080249_fix_name_em_all_solo_unlimited_answer_registration.sql`.
- Verificata la definizione SQL remota e testata la logica del guard: durata zero non scade per deadline NULL; una durata finita senza deadline resta scaduta/non valida.

### Navigazione mobile e lobby
- La barra mobile contiene sei destinazioni, ma una regola CSS successiva ne impostava cinque colonne. Ripristinate sei colonne e forzata la visibilitÃ  dell'icona SVG di Â«CreaÂ».
- Il launcher Wheel mobile ora mostra la stessa icona Lucide Dices del desktop; l'emoji Ã¨ nascosta.
- Il badge di stato Â«ProntoÂ» nella lobby Ã¨ vincolato a una singola riga, senza wrapping o restrin¶»§q«^