/**
 * Automated message seeder — generates 1-2 realistic anonymous messages per day
 * to keep the website looking active and fresh for visitors from social media.
 *
 * Messages are pre-written templates inserted via createApprovedMessage()
 * (service client, bypasses RLS, auto-approved).
 */
import { createApprovedMessage, getApprovedMessages } from '@wlu/shared';

export interface MessageTemplate {
  from: string;
  to: string;
  content: string;
}

/**
 * Pool of ~100 hand-written messages with varied emotional tones.
 * Covers: nostalgia, regret, gratitude, love, forgiveness, longing, growth.
 * Mix of named and anonymous from/to fields for variety.
 */
export const MESSAGE_POOL: MessageTemplate[] = [
  // --- Nostalgia ---
  // NOTE: DB constraint: from/to max 25 chars, content max 500 chars
  {
    from: 'Emma',
    to: 'Lily',
    content: 'I found that photo of us on the fire escape at 3am. We thought we had all the time in the world. I miss being that careless.',
  },
  {
    from: 'Jake',
    to: 'Sophie',
    content: 'We used to talk about what our lives would look like at 25. I wonder if either of us got it right. I hope your version turned out beautiful.',
  },
  {
    from: 'A Stranger on the Train',
    to: 'The Girl with Murakami',
    content: 'We rode the same train for two years. You never looked up from your book. I never worked up the nerve to say hello. I still think about what if.',
  },

  // --- Regret ---
  {
    from: 'The One Who Left',
    to: 'Everyone I Ghosted',
    content: 'I told myself it was easier this way. It wasn\'t. I just didn\'t know how to say "I\'m struggling" without feeling like a burden. I\'m sorry.',
  },
  {
    from: 'Marcus',
    to: 'Sarah',
    content: 'I don\'t know when we became strangers living in the same family. I keep meaning to call but the silence has gotten so loud I don\'t know where to start.',
  },
  {
    from: 'Someone Trying Harder',
    to: 'My Ex',
    content: 'You deserved someone who could stay. I know that now. I hope you found them. I hope they hold you the way I should have.',
  },

  // --- Gratitude ---
  {
    from: 'Your Student',
    to: 'Mrs. Chen',
    content: 'You told me I had a voice worth hearing. I didn\'t believe you then. I just published my first book. Your name is in the dedication. I hope you see it.',
  },
  {
    from: 'Rachel',
    to: 'Jordan',
    content: 'You didn\'t ask questions. You just said "I\'m on my way." That night could have ended differently. You saved my life and I never told you.',
  },
  {
    from: 'A Grateful Stranger',
    to: 'The Barista',
    content: 'You wrote "you\'ve got this" on my cup during the hardest week of my life. Such a small thing. It meant everything.',
  },

  // --- Love (unspoken) ---
  {
    from: 'Still Yours',
    to: 'The One Who Doesn\'t Know',
    content: 'Every love song is about you and you have no idea. I\'ve rewritten this message eleven times. None of them capture what you do to my heartbeat.',
  },
  {
    from: 'Alex',
    to: 'Two Desks Over',
    content: 'You laugh at your own jokes before you even finish telling them. It\'s the most honest thing I\'ve ever seen. I think I might be falling for you.',
  },
  {
    from: 'Noah',
    to: 'My Best Friend',
    content: 'I practiced telling you how I felt in the mirror for a week. Then you told me about her. I smiled and said I was happy for you. Half of that was true.',
  },

  // --- Forgiveness ---
  {
    from: 'Your Daughter',
    to: 'Dad',
    content: 'I spent years being angry at you for leaving. Then I had a kid of my own and realized how terrifying it must have been. I\'m not ready to call yet. But I forgive you.',
  },
  {
    from: 'The Friend You Hurt',
    to: 'The One Who Said Sorry',
    content: 'I read your apology letter four times. I couldn\'t respond because I was crying too hard. Not from the pain anymore — from the relief of being seen.',
  },
  {
    from: 'Someone Letting Go',
    to: 'Myself at 16',
    content: 'Stop carrying everyone else\'s weight. You\'re allowed to set things down. The people who love you will still be there when your arms are empty.',
  },

  // --- Longing ---
  {
    from: 'Across the Ocean',
    to: 'Mia',
    content: 'There are 5,847 miles between us now. I counted. Some nights I swear I can still smell your shampoo on my pillow. Distance doesn\'t erase anything.',
  },
  {
    from: 'Your Old Neighbor',
    to: 'The Family That Moved',
    content: 'Your porch light was always the first one on in the evening. This street feels darker without you. The new neighbors are nice. They\'re not you.',
  },
  {
    from: 'Still Waiting',
    to: 'The Text That Never Came',
    content: 'You said "I\'ll call you tomorrow." That was 847 tomorrows ago. I know because some part of me is still counting.',
  },

  // --- Growth ---
  {
    from: 'A Work in Progress',
    to: 'My Therapist',
    content: 'I sat in your parking lot for twenty minutes before that first appointment, ready to drive away. Thank you for what you\'ve helped me become.',
  },
  {
    from: 'Someone Who Finally Left',
    to: 'The City That Raised Me',
    content: 'I outgrew you and it broke my heart. Every skyline I see gets measured against yours. Nothing compares. But I needed room to breathe.',
  },
  {
    from: 'Your Future Self',
    to: 'Anyone at Rock Bottom',
    content: 'I know it doesn\'t feel like it right now, but this is the chapter that changes everything. Keep going. The plot twist is coming.',
  },

  // --- Miscellaneous emotional ---
  {
    from: 'An Only Child',
    to: 'The Sibling I Never Had',
    content: 'I used to set an extra place at my pretend tea parties for you. I\'m 28 now and I still wonder who you would have been.',
  },
  {
    from: 'The Quiet One',
    to: 'Everyone Who Asked',
    content: 'I got so good at saying "I\'m okay" that even I started to believe it. The truth is I\'ve been drowning in shallow water for years.',
  },
  {
    from: 'Ethan',
    to: 'My Dog',
    content: 'You didn\'t care that I was messy or sad or lost. You just put your head on my lap and stayed. No human has ever loved me that simply.',
  },
  {
    from: 'Your Grandmother',
    to: 'The Grandchild Who Visits',
    content: 'You think you come to keep me company. You don\'t know that your visits are the only reason I keep the house clean and the cookies baked. You are my reason.',
  },
  {
    from: 'The One in the Photo',
    to: 'Whoever Finds This',
    content: 'We took this photo on the last good day before everything changed. I look so happy it almost hurts. I keep it in my wallet as proof that I once knew how.',
  },
  {
    from: 'A Midnight Thinker',
    to: 'Me Before Grief',
    content: 'I don\'t remember what it felt like to fall asleep without replaying everything. If you\'re still in there somewhere, I\'m trying to find my way back to you.',
  },
  {
    from: 'Chloe',
    to: 'Ben',
    content: 'We swore we\'d never be those people who drifted apart. I guess promises made at 22 don\'t always survive the real world. I still have our playlist saved.',
  },
  {
    from: 'Someone Who Gets It Now',
    to: 'Mom',
    content: 'I used to think your rules were suffocating. Now I recognize them as the shape of your love when words weren\'t enough. I get it now. Thank you.',
  },
  {
    from: 'A Late-Night Driver',
    to: 'That One Song',
    content: 'Three notes in and I\'m 19 again, parked outside your apartment, deciding whether to knock. The song ends. I keep driving. Every single time.',
  },
  {
    from: 'The One Who Noticed',
    to: 'The Door Holder',
    content: 'You held the door and said "after you" like it was nothing. I was carrying groceries and a broken heart. Your kindness cracked me open in the best way.',
  },

  // --- Additional Nostalgia ---
  {
    from: 'Daniel',
    to: 'Grace',
    content: 'We thought the world was ours. Driving with the windows down, no destination, just the feeling of being invincible. I\'d give anything for one more aimless drive.',
  },
  {
    from: 'Your Lab Partner',
    to: 'The One Who Made It Fun',
    content: 'We almost failed chemistry but I\'ve never laughed harder in my life. You made terrible things feel survivable. I think about that more than you know.',
  },
  {
    from: 'A Summer Kid',
    to: 'The Lake House',
    content: 'Fireflies and screen doors and the sound of my cousins laughing down the hall. That house held every good memory I have. They sold it last year.',
  },
  {
    from: 'Someone Who Moved Away',
    to: 'My Hometown',
    content: 'I drove through you last week. The diner\'s gone. The field where we played is a parking lot now. But standing on that corner, I was twelve again for a second.',
  },
  {
    from: 'A Former Dancer',
    to: 'The Studio Mirror',
    content: 'I used to watch myself spin for hours in that room. My body doesn\'t move like that anymore, but sometimes I hear the music and my feet still remember.',
  },

  // --- Additional Regret ---
  {
    from: 'Someone Who Chose Wrong',
    to: 'The Path Not Taken',
    content: 'I picked safe. Stable. Reasonable. And I lie awake wondering what the brave choice would have looked like. I think it would have looked a lot like you.',
  },
  {
    from: 'Liam',
    to: 'Ava',
    content: 'I told you it didn\'t bother me. It did. I said I was fine with it. I wasn\'t. By the time I was ready to be honest, you\'d already stopped asking.',
  },
  {
    from: 'A Tired Parent',
    to: 'My Kids\' Childhood',
    content: 'I was so busy building a life for you that I forgot to be in it. The photos show me on my phone in the background while you played. I\'m so sorry.',
  },
  {
    from: 'The One Who Ran',
    to: 'The Love I Left',
    content: 'You were the first person who felt safe, and that terrified me. Running was the stupidest brave thing I\'ve ever done. I hope you know it had nothing to do with you.',
  },
  {
    from: 'Someone Haunted',
    to: 'The Last Conversation',
    content: 'I ended the call too quickly. I said "talk later" instead of "I love you." I didn\'t know there wouldn\'t be a later. That haunts me every single day.',
  },
  {
    from: 'A Reformed Bully',
    to: 'The Kid I Was Cruel To',
    content: 'I was drowning in my own pain and I took it out on you. That doesn\'t excuse anything. I carry the look on your face with me. I\'m sorry I ever put it there.',
  },
  {
    from: 'Someone Who Knows Now',
    to: 'The Help I Refused',
    content: 'You reached out and I pushed back so hard you stopped trying. I wasn\'t ready then. I am now. But you\'ve already gone quiet, and I deserve that.',
  },

  // --- Additional Gratitude ---
  {
    from: 'A Nervous Flyer',
    to: 'Seat 14B',
    content: 'I was white-knuckling through turbulence and you put your hand near mine on the armrest and said "I\'m scared too." I\'ve never been so grateful for a stranger.',
  },
  {
    from: 'Hannah',
    to: 'Whoever Saved Me a Seat',
    content: 'I walked into that cafeteria ready to eat alone for the rest of the year. You waved me over like it was the most natural thing in the world. It changed everything.',
  },
  {
    from: 'A Recovering Addict',
    to: 'The Sponsor Who Stayed',
    content: 'I relapsed and you didn\'t flinch. You just said "okay, we start again." Nobody had ever made starting over sound so simple. You gave me permission to be human.',
  },
  {
    from: 'A Midnight Caller',
    to: 'The Crisis Line Voice',
    content: 'I don\'t know your name. You\'ll never know mine. But your voice at 2:47am kept me here for sunrise. I\'ve seen 1,460 sunrises since then. Each one is yours.',
  },
  {
    from: 'Maya',
    to: 'The Librarian',
    content: 'You didn\'t just hand me books. You handed me worlds where I could disappear when this one was too much. You saved me and probably don\'t even know it.',
  },

  // --- Additional Love (unspoken) ---
  {
    from: 'The One Across the Bar',
    to: 'Blue Jacket, Tuesday',
    content: 'You caught me staring and smiled instead of looking away. I spent the rest of the night building a life with you in my head. I never even got your name.',
  },
  {
    from: 'Silently Yours',
    to: 'My Married Friend',
    content: 'I know you\'re happy. I\'m happy you\'re happy. But sometimes when you rest your head on my shoulder during movies, I close my eyes and pretend just for a second.',
  },
  {
    from: 'Leo',
    to: 'Elena',
    content: 'You read me a poem once and I forgot how to breathe. Every verse sounded like something I\'d been trying to say my whole life. I think I\'m in love with your mind.',
  },
  {
    from: 'Your Running Partner',
    to: 'Mile Marker 3',
    content: 'That\'s where you always tell me about your day. Your voice gets softer when you talk about things that matter. I pace myself just to make those miles last longer.',
  },
  {
    from: 'The Quiet Admirer',
    to: 'The Loud Laugher',
    content: 'You laugh with your whole body. Head back, eyes shut, completely unguarded. It\'s the most beautiful sound I\'ve ever heard and you don\'t even know I\'m listening.',
  },
  {
    from: 'Your Neighbor Upstairs',
    to: 'The Piano Player',
    content: 'You play every night around 9. I sit on my floor and listen through the ceiling. You stumble on the same chord every time and I silently root for you to get it.',
  },

  // --- Additional Forgiveness ---
  {
    from: 'The Angry Teenager',
    to: 'Mom, Years Later',
    content: 'I slammed so many doors. I said things designed to cut. And every morning you still made breakfast. I understand now — that was your way of saying "I\'m still here."',
  },
  {
    from: 'The One Who Cheated',
    to: 'The One Who Found Out',
    content: 'You asked me why and I gave you every answer except the real one: I was broken and too proud to admit it. You deserved honesty. You deserve this truth now.',
  },
  {
    from: 'Ryan',
    to: 'Sam',
    content: 'I didn\'t understand your choices until life put me in the same corner. I\'m sorry for every raised eyebrow, every careful silence. You were surviving. I should have seen that.',
  },
  {
    from: 'A Grown Child',
    to: 'My Imperfect Parents',
    content: 'I used to keep a list of everything you did wrong. Then I became an adult and realized you were just two scared people doing your best. The list doesn\'t exist anymore.',
  },

  // --- Additional Longing ---
  {
    from: 'A Window Watcher',
    to: 'The Season That Reminds Me',
    content: 'October comes and I smell cinnamon and woodsmoke and suddenly I\'m standing in your kitchen again, your sweater too big on me, your coffee too strong. I miss that version of us.',
  },
  {
    from: 'The One Left Behind',
    to: 'The Traveler',
    content: 'You\'re out there collecting passport stamps and I\'m here memorizing the shapes your absence makes. Every postcard you send lands like a paper cut I don\'t want to heal.',
  },
  {
    from: 'Priya',
    to: 'The Other Timeline',
    content: 'Somewhere in a parallel universe, I said yes instead of maybe. I stayed instead of left. I wonder if that version of me sleeps better than I do.',
  },
  {
    from: 'Someone Still Hungry',
    to: 'Grandma\'s Kitchen',
    content: 'Nobody makes it like you did. I\'ve tried your recipe forty times. It\'s never the same. I think the secret ingredient was you humming while you stirred.',
  },
  {
    from: 'The Night Owl',
    to: '3am Thoughts',
    content: 'This is the hour when the truth gets loud. When I stop pretending I\'m over it and let myself miss you so completely it feels like breathing underwater.',
  },
  {
    from: 'Kai',
    to: 'The Place I Can\'t Return',
    content: 'I google-mapped our old street yesterday. The swing set is gone. Someone painted the door red. It\'s still standing but it\'s not home anymore. Home left when you did.',
  },

  // --- Additional Growth ---
  {
    from: 'Someone Rebuilding',
    to: 'The Version I Burned Down',
    content: 'I had to destroy who I was to find out who I could be. The demolition hurt everyone around me. But standing in the rubble, I finally had room to build something honest.',
  },
  {
    from: 'A New Beginning',
    to: 'The First Morning After',
    content: 'I woke up and the weight was different. Not gone — just mine now. Chosen instead of inflicted. That was the morning I realized I was going to be okay.',
  },
  {
    from: 'Nora',
    to: 'My Biggest Failure',
    content: 'You taught me more about myself than any success ever did. I don\'t regret you anymore. I understand you now. You were the ugly lesson I needed most.',
  },
  {
    from: 'The Quiet One',
    to: 'The Voice I Found',
    content: 'I spent decades whispering. Agreeing. Disappearing. Then one day I heard myself say "no" out loud and the whole sky didn\'t fall. That small word changed everything.',
  },
  {
    from: 'Someone Healing',
    to: 'The Wound That Became a Window',
    content: 'Where I expected a scar, I found an opening. Everything I was trying to keep out was exactly what I needed to let in. Breaking was the beginning, not the end.',
  },

  // --- Courage ---
  {
    from: 'The One Who Spoke Up',
    to: 'The Room That Went Quiet',
    content: 'My voice shook. My hands trembled. But I said the thing nobody wanted to hear and the silence that followed was the loudest applause I\'ve ever received.',
  },
  {
    from: 'Theo',
    to: 'The Blank Page',
    content: 'I\'m 43 and beginning again. Everyone says I\'m brave. I don\'t feel brave. I feel terrified. But I\'d rather be scared and moving than comfortable and stuck.',
  },
  {
    from: 'A Truth Teller',
    to: 'The Mirror',
    content: 'I finally stopped performing for you. No angles, no filters, no rehearsed expressions. Just me, tired and honest and still standing. That\'s enough. That\'s more than enough.',
  },

  // --- Family ---
  {
    from: 'The Youngest Sibling',
    to: 'The One Who Went First',
    content: 'You paved every road I walked on. Fought every battle so I didn\'t have to. I got the easier version of our parents because you broke them in. Thank you for going first.',
  },
  {
    from: 'Isaac',
    to: 'My Mother',
    content: 'I held my baby at 4am and suddenly understood every sacrifice you made. Every tired morning, every meal you skipped, every dream you postponed. You were a hero in disguise.',
  },
  {
    from: 'The Estranged One',
    to: 'My Family',
    content: 'I didn\'t leave because I stopped loving you. I left because the love came wrapped in conditions I couldn\'t meet. Maybe one day we\'ll find a version of us that\'s unconditional.',
  },
  {
    from: 'A Grieving Child',
    to: 'The Empty Chair',
    content: 'Every holiday, someone sits in your spot. No one mentions it. But we all feel the temperature drop where your warmth used to be. The table\'s never really full anymore.',
  },

  // --- Friendship ---
  {
    from: 'The Flaky One',
    to: 'Clara',
    content: 'I cancelled so many times that you stopped asking. I don\'t blame you. But I need you to know — every cancellation was anxiety, not apathy. I wanted to come. I just couldn\'t.',
  },
  {
    from: 'Someone Who Outgrew',
    to: 'My High School Group',
    content: 'We swore we\'d be different. We\'d never drift. But I changed and you stayed the same and neither of us was wrong. Just different chapters of the same story.',
  },
  {
    from: 'The One Who Moved On',
    to: 'The Friend Who Held On',
    content: 'I stopped texting first to see if you\'d notice. You did. You texted the next morning. I cried because I realized I was testing someone who had already passed every test.',
  },
  {
    from: 'Tyler',
    to: 'Jay',
    content: 'I can\'t fix this for you. I know that. But I can sit in the dark with you until your eyes adjust. I\'m not going anywhere. Take as long as you need.',
  },

  // --- Self-reflection ---
  {
    from: 'Someone Who Pretends',
    to: 'The Happy Mask',
    content: 'I\'ve worn you so long I forgot what my real face looks like underneath. People love you. They trust you. But you\'re not me. And I\'m tired of letting you answer for me.',
  },
  {
    from: 'A Workaholic',
    to: 'The Life I Keep Postponing',
    content: 'I say "after this project" and "once things calm down" but they never do. I built an empire at my desk and an empty apartment behind it. The trade wasn\'t worth it.',
  },
  {
    from: 'Someone in Recovery',
    to: 'Day One',
    content: 'You were the hardest day. But also the most honest. For the first time I said "I need help" without whispering. Turns out the words don\'t break you — they build you.',
  },
  {
    from: 'A Perfectionist',
    to: 'Good Enough',
    content: 'I spent years running from you. Treating you like failure in a nicer outfit. But you were always the finish line I needed. Perfect was the race I was never supposed to win.',
  },

  // --- Loss ---
  {
    from: 'The One Who Stayed',
    to: 'The Hospital Room',
    content: 'I memorized the rhythm of every machine. The nurse\'s shoes on the tile. The hum of the fluorescent light. Terrible sounds. But they meant you were still here. I\'d listen to them forever.',
  },
  {
    from: 'A Widow',
    to: 'Your Side of the Bed',
    content: 'I still sleep on my half. The other side is cold but I can\'t bring myself to move into it. That would make it real. And I\'m not ready for real yet.',
  },
  {
    from: 'Owen',
    to: 'The Voicemail I Can\'t Delete',
    content: 'It\'s just you saying "hey, call me back." Seven words. But it\'s your voice and you\'re alive in it and I play it when the silence gets too honest.',
  },
  {
    from: 'A Pet Owner',
    to: 'The Leash by the Door',
    content: 'I keep forgetting to put you away. Or maybe I don\'t want to. You still look like a promise — like any second the door will open and I\'ll hear those paws on the floor again.',
  },

  // --- Hope ---
  {
    from: 'Someone Looking Up',
    to: 'The First Star',
    content: 'I made a wish on you every night when I was small. I stopped for twenty years. Tonight I\'m starting again. Not because I believe. Because I need to want something again.',
  },
  {
    from: 'Zoe',
    to: 'The Life I Almost Missed',
    content: 'Two years ago I wasn\'t sure I\'d make it to morning. Today I planted a garden. Dug my hands into dirt and planted something that won\'t bloom for months. That\'s called faith.',
  },
  {
    from: 'Someone Choosing Joy',
    to: 'The Bad Days',
    content: 'You still come. I won\'t pretend you don\'t. But you don\'t unpack anymore. You visit, I feel you, and I let you leave. That\'s the difference. I let you leave now.',
  },
  {
    from: 'A Late Bloomer',
    to: 'Everyone Who Gave Up on Me',
    content: 'I know I took longer than expected. The seeds you planted didn\'t die — they just had deeper roots to grow. I\'m finally blooming and I wish you could see it.',
  },

  // --- Strangers ---
  {
    from: 'A People Watcher',
    to: 'The Couple at Table 9',
    content: 'You held hands across the table like you were afraid the other might float away. I don\'t know your story. But watching you made me believe in something I\'d given up on.',
  },
  {
    from: 'The Crying Stranger',
    to: 'The Woman on the Bench',
    content: 'You sat down next to me while I was falling apart in public. You didn\'t speak. Just handed me a tissue and stayed. Sometimes silence is the kindest language.',
  },
  {
    from: 'A Commuter',
    to: 'The Busker at Central',
    content: 'You play violin at the same spot every Tuesday. Everyone walks past but I slow down. Your music turns my commute into something worth remembering. Don\'t stop playing.',
  },

  // --- Letting Go ---
  {
    from: 'Someone Unclenching',
    to: 'The Grudge I Carried',
    content: 'I held onto you so tight my fingers went numb. Then I realized you were heavier than the hurt you were supposed to protect me from. Letting go hurt less than holding on.',
  },
  {
    from: 'The One Moving Forward',
    to: 'What Could Have Been',
    content: 'I\'m done building a shrine to you. The candles are out, the flowers are dry, and I\'m choosing to live in a house with windows instead of a museum of might-have-beens.',
  },
  {
    from: 'Someone Breathing Easier',
    to: 'The Weight I Put Down',
    content: 'I carried you for so long I forgot what standing straight felt like. My shoulders ache from the memory of you. But my lungs are full for the first time in years.',
  },
];

interface SeedOptions {
  count?: number;
  dryRun?: boolean;
}

interface SeedResult {
  seeded: number;
  skipped: number;
}

/**
 * Seed the website with new anonymous messages.
 * Picks random unused templates and inserts them as approved messages.
 */
export async function seedDailyMessages(
  options: SeedOptions = {},
): Promise<SeedResult> {
  const { count = 2, dryRun = false } = options;

  // Get existing messages to avoid duplicates
  const existing = await getApprovedMessages({ limit: 200 });
  const existingContents = new Set(
    existing.map((m) => m.content.toLowerCase().trim()),
  );

  // Check how many were seeded today (avoid double-seeding)
  const today = new Date().toISOString().split('T')[0];
  const seededToday = existing.filter((m) => m.created_at.startsWith(today)).length;

  if (seededToday >= count) {
    console.log(`[seed-messages] Already ${seededToday} messages today (target: ${count}). Skipping.`);
    return { seeded: 0, skipped: count };
  }

  const toSeed = count - seededToday;
  console.log(`[seed-messages] Seeding ${toSeed} new messages (${seededToday} already today)...`);

  // Filter to unused templates
  const available = MESSAGE_POOL.filter(
    (t) => !existingContents.has(t.content.toLowerCase().trim()),
  );

  if (available.length === 0) {
    console.log('[seed-messages] All templates have been used! Pool exhausted.');
    return { seeded: 0, skipped: toSeed };
  }

  console.log(`[seed-messages] ${available.length} unused templates available`);

  // Shuffle and pick
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const picks = shuffled.slice(0, toSeed);

  let seeded = 0;
  for (const template of picks) {
    if (dryRun) {
      console.log(`[seed-messages] [DRY RUN] Would seed: "${template.content.slice(0, 60)}..."`);
      seeded++;
      continue;
    }

    try {
      const msg = await createApprovedMessage({
        from: template.from,
        to: template.to,
        content: template.content,
        seeded: true,
      });
      seeded++;
      console.log(`[seed-messages] Seeded message ${msg.id}: "${template.content.slice(0, 50)}..."`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[seed-messages] Failed to seed: ${errMsg.slice(0, 100)}`);
    }
  }

  console.log(`[seed-messages] Done — seeded ${seeded}/${toSeed}`);
  return { seeded, skipped: toSeed - seeded };
}
