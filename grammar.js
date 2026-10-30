'use strict';
// Beginner grammar lessons.
// examples: [written (read aloud), kana, romaji, English]
// check: { q, opts: [correct, ...wrong], why } - options are shuffled when shown.
const GRAMMAR = [
  {
    id: 'wa-desu', title: 'X is Y', jp: '〜は〜です',
    points: [
      'は marks the topic, the thing you are talking about. As a particle it is pronounced "wa", not "ha".',
      'です at the end makes the sentence polite. It works like "is / am / are".',
      'The topic is often dropped when it is obvious. がくせいです on its own can mean "I am a student."',
    ],
    pattern: '[topic] は [noun] です。',
    examples: [
      ['私は学生です。', 'わたしはがくせいです。', 'watashi wa gakusei desu.', 'I am a student.'],
      ['私はアメリカ人です。', 'わたしはアメリカじんです。', 'watashi wa amerikajin desu.', 'I am American.'],
      ['田中さんは先生です。', 'たなかさんはせんせいです。', 'tanaka-san wa sensei desu.', 'Mr./Ms. Tanaka is a teacher.'],
      ['今日は月曜日です。', 'きょうはげつようびです。', 'kyou wa getsuyoubi desu.', 'Today is Monday.'],
    ],
    check: [
      { q: 'わたし ＿ エンジニアです。 (I am an engineer.)', opts: ['は', 'を', 'に', 'か'], why: 'は marks the topic, わたし.' },
      { q: 'How is the particle は pronounced?', opts: ['wa', 'ha', 'e', 'o'], why: 'As a particle, は is read "wa".' },
      { q: 'What does です add to a sentence?', opts: ['Politeness, like "is / am"', 'A question', 'Past tense', 'Negation'], why: 'です is the polite "to be".' },
    ],
  },
  {
    id: 'ka', title: 'Asking questions', jp: '〜か',
    points: [
      'Add か to the end of a sentence to turn it into a question. The word order does not change.',
      'Question words (なん what, どこ where, だれ who) go where the answer would go.',
      'To answer: はい、そうです (yes, that is right) or いいえ、ちがいます (no, that is not right).',
    ],
    pattern: '[sentence] か。',
    examples: [
      ['学生ですか。', 'がくせいですか。', 'gakusei desu ka.', 'Are you a student?'],
      ['はい、そうです。', 'はい、そうです。', 'hai, sou desu.', "Yes, that's right."],
      ['いいえ、違います。', 'いいえ、ちがいます。', 'iie, chigaimasu.', "No, that's not right."],
      ['これは何ですか。', 'これはなんですか。', 'kore wa nan desu ka.', 'What is this?'],
      ['トイレはどこですか。', 'トイレはどこですか。', 'toire wa doko desu ka.', 'Where is the restroom?'],
    ],
    check: [
      { q: 'To turn げんきです into a question, add…', opts: ['か', 'ね', 'よ', 'を'], why: 'か at the end makes a question.' },
      { q: 'トイレは ＿ ですか。 (Where is the restroom?)', opts: ['どこ', 'なに', 'だれ', 'いつ'], why: 'どこ = where.' },
      { q: 'いいえ、ちがいます means…', opts: ["No, that's not right", "Yes, that's right", "I don't know", 'Thank you'], why: 'ちがいます = "it is different / wrong".' },
    ],
  },
  {
    id: 'janai', title: 'Is not', jp: '〜じゃないです',
    points: [
      'To say "X is not Y", replace です with じゃないです (everyday polite) or ではありません (more formal).',
      'Both are correct. ではありません is common in writing, announcements and textbooks.',
    ],
    pattern: '[topic] は [noun] じゃないです。',
    examples: [
      ['私は先生じゃないです。', 'わたしはせんせいじゃないです。', 'watashi wa sensei ja nai desu.', 'I am not a teacher.'],
      ['これは寿司ではありません。', 'これはすしではありません。', 'kore wa sushi de wa arimasen.', 'This is not sushi.'],
      ['今日は休みじゃないです。', 'きょうはやすみじゃないです。', 'kyou wa yasumi ja nai desu.', 'Today is not a day off.'],
    ],
    check: [
      { q: 'The negative of がくせいです is…', opts: ['がくせいじゃないです', 'がくせいですか', 'がくせいでした', 'がくせいがいます'], why: 'Replace です with じゃないです.' },
      { q: 'ではありません is…', opts: ['A more formal "is not"', 'The past tense', 'A question', '"There is"'], why: 'It means the same as じゃないです, just more formal.' },
    ],
  },
  {
    id: 'kosoado', title: 'This, that, over there', jp: 'これ・それ・あれ',
    points: [
      'これ = this (near me). それ = that (near you). あれ = that over there (far from both). どれ = which one?',
      'Right before a noun, use この / その / あの / どの instead: このほん = this book.',
      'The same pattern works for places: ここ (here), そこ (there), あそこ (over there), どこ (where).',
    ],
    pattern: 'これ は… ・ この [noun] は…',
    examples: [
      ['これは何ですか。', 'これはなんですか。', 'kore wa nan desu ka.', 'What is this?'],
      ['それは私の鞄です。', 'それはわたしのかばんです。', 'sore wa watashi no kaban desu.', 'That is my bag.'],
      ['あの人は誰ですか。', 'あのひとはだれですか。', 'ano hito wa dare desu ka.', 'Who is that person over there?'],
      ['このラーメンは美味しいです。', 'このラーメンはおいしいです。', 'kono raamen wa oishii desu.', 'This ramen is delicious.'],
      ['駅はあそこです。', 'えきはあそこです。', 'eki wa asoko desu.', 'The station is over there.'],
    ],
    check: [
      { q: 'Something far from both you and the listener:', opts: ['あれ', 'これ', 'それ', 'どれ'], why: 'あれ = that over there.' },
      { q: '＿ ほんはおもしろいです。 (This book is interesting.)', opts: ['この', 'これ', 'ここ', 'どの'], why: 'Before a noun, use この, not これ.' },
      { q: 'どこ means…', opts: ['Where', 'What', 'Which one', 'Who'], why: 'どこ is the "where" member of ここ・そこ・あそこ・どこ.' },
    ],
  },
  {
    id: 'no', title: "Possession: A's B", jp: '〜の〜',
    points: [
      'の links two nouns, like "\'s" or "of" in English: わたしのほん = my book.',
      'You can chain them: わたしのともだちのくるま = my friend\'s car.',
      'It also describes a type: にほんごのせんせい = a Japanese-language teacher.',
    ],
    pattern: '[noun A] の [noun B]  →  A\'s B',
    examples: [
      ['私の名前はジョンです。', 'わたしのなまえはジョンです。', 'watashi no namae wa jon desu.', 'My name is John.'],
      ['これは誰の傘ですか。', 'これはだれのかさですか。', 'kore wa dare no kasa desu ka.', 'Whose umbrella is this?'],
      ['日本語の先生', 'にほんごのせんせい', 'nihongo no sensei', 'a Japanese teacher'],
      ['友達の車', 'ともだちのくるま', 'tomodachi no kuruma', "my friend's car"],
    ],
    check: [
      { q: 'わたし ＿ かばん (my bag)', opts: ['の', 'は', 'を', 'と'], why: 'の shows possession.' },
      { q: 'だれのかさですか means…', opts: ['Whose umbrella is it?', 'Where is the umbrella?', 'Is this an umbrella?', 'Who has an umbrella?'], why: 'だれの = whose.' },
    ],
  },
  {
    id: 'masu', title: 'Polite verbs', jp: '〜ます・〜ません',
    points: [
      'Polite verbs end in ます. The same form covers habits and the future: たべます = I eat / I will eat.',
      'For the negative, change ます to ません: たべません = I don\'t eat / won\'t eat.',
      'Verbs go at the end of the sentence.',
      'Dictionary form → ます form: たべる → たべます, のむ → のみます, いく → いきます, する → します, くる → きます.',
    ],
    pattern: '[verb stem] ます ・ [verb stem] ません',
    examples: [
      ['毎日コーヒーを飲みます。', 'まいにちコーヒーをのみます。', 'mainichi koohii o nomimasu.', 'I drink coffee every day.'],
      ['明日東京に行きます。', 'あしたとうきょうにいきます。', 'ashita toukyou ni ikimasu.', 'I will go to Tokyo tomorrow.'],
      ['肉を食べません。', 'にくをたべません。', 'niku o tabemasen.', "I don't eat meat."],
      ['仕事をします。', 'しごとをします。', 'shigoto o shimasu.', 'I (will) work.'],
    ],
    check: [
      { q: 'Polite form of のむ (to drink):', opts: ['のみます', 'のむます', 'のまます', 'のめます'], why: 'む → み + ます.' },
      { q: 'Negative of いきます:', opts: ['いきません', 'いきました', 'いきますか', 'いきない'], why: 'ます → ません.' },
      { q: 'たべます can mean…', opts: ['I eat / I will eat', 'I ate', "I didn't eat", "Let's eat"], why: 'The ます form is non-past: present or future.' },
    ],
  },
  {
    id: 'wo', title: 'The object particle', jp: '〜を',
    points: [
      'を marks the thing an action is done to: what you eat, drink, read or buy.',
      'It is pronounced "o".',
      'Order: [object] を [verb].',
    ],
    pattern: '[object] を [verb]ます',
    examples: [
      ['寿司を食べます。', 'すしをたべます。', 'sushi o tabemasu.', 'I eat sushi.'],
      ['本を読みます。', 'ほんをよみます。', 'hon o yomimasu.', 'I read a book.'],
      ['水をください。', 'みずをください。', 'mizu o kudasai.', 'Water, please.'],
      ['日本語を勉強します。', 'にほんごをべんきょうします。', 'nihongo o benkyou shimasu.', 'I study Japanese.'],
    ],
    check: [
      { q: 'コーヒー ＿ のみます。', opts: ['を', 'は', 'に', 'の'], why: 'Coffee is the object of drinking.' },
      { q: 'How is を pronounced in a sentence?', opts: ['o', 'wa', 'e', 'ni'], why: 'を sounds like お.' },
    ],
  },
  {
    id: 'past', title: 'Past tense', jp: '〜ました・〜でした',
    points: [
      'ます → ました for the past: たべました = I ate.',
      'ません → ませんでした for the past negative: たべませんでした = I didn\'t eat.',
      'For nouns, です → でした (was).',
    ],
    pattern: '〜ました ・ 〜ませんでした ・ 〜でした',
    examples: [
      ['昨日ラーメンを食べました。', 'きのうラーメンをたべました。', 'kinou raamen o tabemashita.', 'I ate ramen yesterday.'],
      ['今朝コーヒーを飲みませんでした。', 'けさコーヒーをのみませんでした。', 'kesa koohii o nomimasen deshita.', "I didn't drink coffee this morning."],
      ['昨日は休みでした。', 'きのうはやすみでした。', 'kinou wa yasumi deshita.', 'Yesterday was a day off.'],
      ['日本に行きました。', 'にほんにいきました。', 'nihon ni ikimashita.', 'I went to Japan.'],
    ],
    check: [
      { q: 'Past of みます (to see):', opts: ['みました', 'みませんでした', 'みますか', 'みましょう'], why: 'ます → ました.' },
      { q: '"I didn\'t buy" (かいます):', opts: ['かいませんでした', 'かいました', 'かいません', 'かいましょう'], why: 'ません → ませんでした.' },
      { q: 'Past of です:', opts: ['でした', 'ました', 'じゃない', 'でしょう'], why: 'です → でした.' },
    ],
  },
  {
    id: 'ni-de', title: 'Where and when', jp: '〜に・〜で',
    points: [
      'に marks a destination: えきにいきます = go to the station. (へ also works here; it is pronounced "e".)',
      'に also marks a specific time: しちじにおきます = I wake up at 7.',
      'で marks where an action happens: レストランでたべます = eat at a restaurant.',
      'で also marks the means: でんしゃでいきます = go by train.',
    ],
    pattern: '[place] に いきます ・ [place] で [action] ・ [time] に',
    examples: [
      ['会社に行きます。', 'かいしゃにいきます。', 'kaisha ni ikimasu.', 'I go to the office.'],
      ['七時に起きます。', 'しちじにおきます。', 'shichiji ni okimasu.', 'I wake up at 7.'],
      ['家で晩ご飯を食べます。', 'うちでばんごはんをたべます。', 'uchi de bangohan o tabemasu.', 'I eat dinner at home.'],
      ['電車で行きます。', 'でんしゃでいきます。', 'densha de ikimasu.', 'I go by train.'],
    ],
    check: [
      { q: 'がっこう ＿ いきます。 (go to school)', opts: ['に', 'で', 'を', 'の'], why: 'に marks the destination.' },
      { q: 'レストラン ＿ たべます。 (eat at a restaurant)', opts: ['で', 'に', 'を', 'は'], why: 'で marks where the action happens.' },
      { q: 'くるま ＿ いきます。 (go by car)', opts: ['で', 'に', 'を', 'が'], why: 'で marks the means.' },
    ],
  },
  {
    id: 'i-adj', title: 'い-adjectives', jp: '〜い',
    points: [
      'Many describing words end in い: おおきい, たかい, おいしい.',
      'Put them before a noun (たかいくるま = an expensive car) or at the end with です (くるまはたかいです).',
      'Negative: drop い, add くないです → たかくないです.',
      'Past: drop い, add かったです → たかかったです.',
      'Irregular: いい (good) → よくないです, よかったです.',
    ],
    pattern: '〜いです ・ 〜くないです ・ 〜かったです',
    examples: [
      ['今日は寒いです。', 'きょうはさむいです。', 'kyou wa samui desu.', "It's cold today."],
      ['この鞄は高くないです。', 'このかばんはたかくないです。', 'kono kaban wa takaku nai desu.', "This bag isn't expensive."],
      ['映画は面白かったです。', 'えいがはおもしろかったです。', 'eiga wa omoshirokatta desu.', 'The movie was interesting.'],
      ['天気が良かったです。', 'てんきがよかったです。', 'tenki ga yokatta desu.', 'The weather was good.'],
    ],
    check: [
      { q: 'Negative of たかい:', opts: ['たかくないです', 'たかいじゃないです', 'たかいません', 'たかかったです'], why: 'Drop い, add くないです.' },
      { q: 'Past of おいしい:', opts: ['おいしかったです', 'おいしいでした', 'おいしくないです', 'おいしいました'], why: 'Drop い, add かったです.' },
      { q: 'Past of いい (good):', opts: ['よかったです', 'いかったです', 'いいでした', 'よくないです'], why: 'いい is irregular and uses よ-.' },
    ],
  },
  {
    id: 'na-adj', title: 'な-adjectives', jp: '〜な',
    points: [
      'Some describing words act more like nouns: きれい, しずか, げんき, すき, ゆうめい.',
      'Before a noun, add な: しずかなまち = a quiet town.',
      'At the end, use です like a noun. Negative: じゃないです. Past: でした.',
      'Watch out: きれい and ゆうめい end in い but are な-adjectives.',
      'すき (like) uses が for the thing you like: すしがすきです.',
    ],
    pattern: '〜な [noun] ・ 〜です ・ 〜じゃないです',
    examples: [
      ['綺麗な花ですね。', 'きれいなはなですね。', 'kirei na hana desu ne.', 'What a pretty flower.'],
      ['この町は静かです。', 'このまちはしずかです。', 'kono machi wa shizuka desu.', 'This town is quiet.'],
      ['寿司が好きです。', 'すしがすきです。', 'sushi ga suki desu.', 'I like sushi.'],
      ['部屋は綺麗じゃないです。', 'へやはきれいじゃないです。', 'heya wa kirei ja nai desu.', "The room isn't clean."],
    ],
    check: [
      { q: '＿ まち (a quiet town)', opts: ['しずかな', 'しずかい', 'しずかの', 'しずかく'], why: 'な-adjectives take な before a noun.' },
      { q: 'Negative of きれいです:', opts: ['きれいじゃないです', 'きれくないです', 'きれいくないです', 'きれいません'], why: 'きれい is a な-adjective, so use じゃないです.' },
      { q: 'Which word is a な-adjective?', opts: ['ゆうめい', 'たかい', 'おおきい', 'さむい'], why: 'ゆうめい (famous) ends in い but is a な-adjective.' },
      { q: 'すし ＿ すきです。', opts: ['が', 'を', 'に', 'で'], why: 'すき takes が.' },
    ],
  },
  {
    id: 'aru-iru', title: 'There is / I have', jp: 'あります・います',
    points: [
      'あります is for things and plants (non-living). います is for people and animals.',
      '[place] に [thing] が あります: つくえのうえにほんがあります = There is a book on the desk.',
      'It also means "have": くるまがあります = I have a car.',
      'Negative: ありません / いません.',
    ],
    pattern: '[place] に [thing] が あります / います',
    examples: [
      ['机の上に本があります。', 'つくえのうえにほんがあります。', 'tsukue no ue ni hon ga arimasu.', 'There is a book on the desk.'],
      ['公園に犬がいます。', 'こうえんにいぬがいます。', 'kouen ni inu ga imasu.', "There's a dog in the park."],
      ['近くにコンビニがありますか。', 'ちかくにコンビニがありますか。', 'chikaku ni konbini ga arimasu ka.', 'Is there a convenience store nearby?'],
      ['兄弟がいます。', 'きょうだいがいます。', 'kyoudai ga imasu.', 'I have siblings.'],
      ['時間がありません。', 'じかんがありません。', 'jikan ga arimasen.', "I don't have time."],
    ],
    check: [
      { q: 'ねこが ＿。 (There is a cat.)', opts: ['います', 'あります', 'です', 'します'], why: 'Animals use います.' },
      { q: 'くるまが ＿。 (There is a car.)', opts: ['あります', 'います', 'です', 'いきます'], why: 'Things use あります.' },
      { q: 'じかんがありません means…', opts: ["I don't have time", 'There is time', 'What time is it?', 'I have a watch'], why: 'ありません = there isn\'t / I don\'t have.' },
    ],
  },
  {
    id: 'tai', title: 'Want to', jp: '〜たいです',
    points: [
      'Take the ます form, drop ます, add たいです: たべます → たべたいです = I want to eat.',
      'Negative: 〜たくないです = I don\'t want to.',
      'Use it for your own wishes. Asking someone else 〜たいですか is fine with friends but can sound direct.',
    ],
    pattern: '[verb stem] たいです',
    examples: [
      ['日本に行きたいです。', 'にほんにいきたいです。', 'nihon ni ikitai desu.', 'I want to go to Japan.'],
      ['寿司が食べたいです。', 'すしがたべたいです。', 'sushi ga tabetai desu.', 'I want to eat sushi.'],
      ['今日は働きたくないです。', 'きょうははたらきたくないです。', 'kyou wa hatarakitaku nai desu.', "I don't want to work today."],
      ['何が飲みたいですか。', 'なにがのみたいですか。', 'nani ga nomitai desu ka.', 'What do you want to drink?'],
    ],
    check: [
      { q: '"I want to see" (みます):', opts: ['みたいです', 'みますたい', 'みるたいです', 'みたくないです'], why: 'Drop ます, add たいです.' },
      { q: '"I don\'t want to go" (いきます):', opts: ['いきたくないです', 'いきたいです', 'いきません', 'いきたいじゃないです'], why: 'たい works like an い-adjective: たくないです.' },
    ],
  },
  {
    id: 'te-kudasai', title: 'Please do…', jp: '〜てください',
    points: [
      '〜てください politely asks someone to do something. It uses the て-form of a verb.',
      'Handy ones to memorize: みてください (please look), まってください (please wait), きいてください (please listen), かいてください (please write), はなしてください (please speak).',
      'る-verbs: drop る, add て → たべる → たべて.',
      'う-verbs change by ending: う/つ/る → って, む/ぶ/ぬ → んで, く → いて, ぐ → いで, す → して.',
      'Exceptions: いく → いって, する → して, くる → きて.',
    ],
    pattern: '[て-form] ください',
    examples: [
      ['ちょっと待ってください。', 'ちょっとまってください。', 'chotto matte kudasai.', 'Please wait a moment.'],
      ['もう一度言ってください。', 'もういちどいってください。', 'mou ichido itte kudasai.', 'Please say it again.'],
      ['ゆっくり話してください。', 'ゆっくりはなしてください。', 'yukkuri hanashite kudasai.', 'Please speak slowly.'],
      ['ここに書いてください。', 'ここにかいてください。', 'koko ni kaite kudasai.', 'Please write it here.'],
      ['これを見てください。', 'これをみてください。', 'kore o mite kudasai.', 'Please look at this.'],
    ],
    check: [
      { q: 'て-form of たべる:', opts: ['たべて', 'たべって', 'たべいて', 'たべんで'], why: 'る-verb: drop る, add て.' },
      { q: 'て-form of のむ:', opts: ['のんで', 'のみて', 'のって', 'のいて'], why: 'む → んで.' },
      { q: 'て-form of いく (exception):', opts: ['いって', 'いいて', 'いきて', 'いんで'], why: 'いく is irregular: いって.' },
      { q: '"Please wait":', opts: ['まってください', 'まつください', 'まちてください', 'まってます'], why: 'まつ → まって (つ → って).' },
    ],
  },
  {
    id: 'mo-to', title: 'Also, and, with', jp: '〜も・〜と',
    points: [
      'も replaces は or が to mean "also / too": わたしもがくせいです = I am a student too.',
      'と joins nouns into a complete list: パンとたまご = bread and eggs.',
      'と also means "with": ともだちといきます = I will go with a friend.',
    ],
    pattern: '[noun] も ・ [noun] と [noun] ・ [person] と',
    examples: [
      ['私もコーヒーが好きです。', 'わたしもコーヒーがすきです。', 'watashi mo koohii ga suki desu.', 'I like coffee too.'],
      ['パンと卵を買いました。', 'パンとたまごをかいました。', 'pan to tamago o kaimashita.', 'I bought bread and eggs.'],
      ['友達と映画を見ます。', 'ともだちとえいがをみます。', 'tomodachi to eiga o mimasu.', "I'll watch a movie with a friend."],
      ['これもください。', 'これもください。', 'kore mo kudasai.', 'This one too, please.'],
    ],
    check: [
      { q: 'わたし ＿ がくせいです。 (I am a student too.)', opts: ['も', 'と', 'は', 'を'], why: 'も = also.' },
      { q: 'かぞく ＿ にほんにいきます。 (go to Japan with my family)', opts: ['と', 'も', 'を', 'の'], why: 'と = with.' },
    ],
  },
  {
    id: 'mashou', title: "Let's… / Won't you…?", jp: '〜ましょう・〜ませんか',
    points: [
      '〜ましょう = "Let\'s…": いきましょう = Let\'s go.',
      '〜ませんか = "Won\'t you…? / Would you like to…?", a soft invitation.',
      'Reply with いいですね (sounds good), or ちょっと… (a polite way to decline without saying no).',
    ],
    pattern: '[verb stem] ましょう ・ [verb stem] ませんか',
    examples: [
      ['行きましょう。', 'いきましょう。', 'ikimashou.', "Let's go."],
      ['一緒に昼ご飯を食べませんか。', 'いっしょにひるごはんをたべませんか。', 'issho ni hirugohan o tabemasen ka.', 'Would you like to have lunch together?'],
      ['いいですね。', 'いいですね。', 'ii desu ne.', 'Sounds good.'],
      ['少し休みましょう。', 'すこしやすみましょう。', 'sukoshi yasumimashou.', "Let's take a short break."],
    ],
    check: [
      { q: '"Let\'s eat":', opts: ['たべましょう', 'たべませんか', 'たべました', 'たべたいです'], why: 'ましょう = let\'s.' },
      { q: '〜ませんか is used to…', opts: ['Invite someone softly', "Say you didn't do something", 'Give an order', 'Ask why'], why: 'It sounds like "won\'t you…?".' },
      { q: 'A polite way to decline an invitation:', opts: ['ちょっと…', 'いいですね', 'はい、そうです', 'いただきます'], why: 'Trailing off with ちょっと… signals "that\'s a bit difficult".' },
    ],
  },
];
