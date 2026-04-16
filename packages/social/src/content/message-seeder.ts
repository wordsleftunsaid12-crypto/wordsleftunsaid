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
 * Pool of realistic anonymous messages designed to feel like real humans wrote them.
 *
 * Guidelines these follow:
 * - To/From fields: mostly real first names, initials, "me", "anonymous", or short
 *   casual descriptions (not literary labels like "The One Who Left")
 * - Varied lengths: some are 1-2 sentences, some are long rambles
 * - Imperfect writing: occasional lowercase, run-on sentences, missing apostrophes,
 *   casual grammar, text-speak. NOT every message has errors — just enough for variety
 * - Raw/casual tone mixed with occasional poetry. Real people sometimes write beautifully
 *   and sometimes just dump their feelings out messily
 * - Diverse names reflecting real demographics
 * - Some mundane, some profound, some angry, some funny
 *
 * DB constraint: from/to max 25 chars, content max 500 chars
 */
export const MESSAGE_POOL: MessageTemplate[] = [
  // --- short and raw ---
  {
    from: 'me',
    to: 'J',
    content: 'i still have your hoodie. i know you dont care but i sleep in it sometimes and i hate myself for it',
  },
  {
    from: 'anonymous',
    to: 'dad',
    content: 'You missed my graduation. Again.',
  },
  {
    from: 'K',
    to: 'Marcus',
    content: 'i typed "i miss you" and then deleted it 4 times today. this is the closest ill get to sending it',
  },
  {
    from: 'your son',
    to: 'mom',
    content: 'I know you read my texts to your boyfriend. I saw your face change at dinner. Im sorry you found out that way. Im not sorry for who I am.',
  },
  {
    from: 'Aisha',
    to: 'Noor',
    content: 'come home. thats it. thats the whole message. just come home.',
  },
  {
    from: 'tired',
    to: 'anyone',
    content: 'does anyone else feel like theyre just pretending to be a functioning adult or is it just me',
  },

  // --- longer, messier ---
  {
    from: 'Sam',
    to: 'Lex',
    content: 'I keep almost texting you every time something funny happens. Like today this pigeon walked into the coffee shop and just stood there judging everyone and all I could think was youd have named it. You name everything. I miss that about you.',
  },
  {
    from: 'anonymous',
    to: 'my therapist',
    content: 'I lied in our last session when I said I was doing better. I dont know why I do that. You literally get paid to hear the truth and I still cant give it to you. Sorry. Ill try harder next tuesday.',
  },
  {
    from: 'Em',
    to: 'the girl at the register',
    content: 'you complimented my earrings yesterday and i literally have not stopped thinking about it. i wanted to say something back but my brain just went blank. you had the nicest smile',
  },
  {
    from: 'Daniel K',
    to: 'Coach Williams',
    content: 'You told me I wasnt cut out for the team junior year. I just finished my first marathon. 3:42:16. Thought you should know.',
  },

  // --- with names, real feeling ---
  {
    from: 'Priya',
    to: 'Amit',
    content: 'Our families would never approve and we both know it. But when you looked at me at Roshans wedding I swear everyone else disappeared. I dont know what to do with that.',
  },
  {
    from: 'Chris',
    to: 'Sarah',
    content: 'I saw you at Target last week with your kid. You looked happy. Really happy. I almost said hi but I didnt want to ruin it. Im glad youre doing well.',
  },
  {
    from: 'Maya',
    to: 'Jordan',
    content: 'You were my person for 6 years and now I dont even know your new phone number. How does that happen? How do you go from everything to nothing that fast?',
  },
  {
    from: 'Tommy',
    to: 'grandpa',
    content: 'I still make your pasta recipe every sunday. Its never as good. Mom says I use too much garlic but you always said theres no such thing. I think youre right.',
  },
  {
    from: 'Bri',
    to: 'Tasha',
    content: 'I heard what you said about me to Keisha. I wasnt supposed to but I did. The crazy thing is youre not even wrong. I just wish youd said it to my face.',
  },
  {
    from: 'anonymous',
    to: 'my neighbor',
    content: 'Your dog barks at 6am every single day and I used to hate it. Now it wakes me up just in time for sunrise and honestly? Best alarm clock Ive ever had. Dont tell anyone I said that.',
  },

  // --- family stuff ---
  {
    from: 'your daughter',
    to: 'dad',
    content: 'I know you and mom tried to hide the fighting but walls are thin. I used to put headphones on and blast music so I wouldnt hear. Some songs still make me feel like that scared kid.',
  },
  {
    from: 'the middle child',
    to: 'my parents',
    content: 'Jess got the attention for being the oldest and Danny got it for being the baby. I got good at being invisible. Im 31 and I still dont know how to ask for what I need.',
  },
  {
    from: 'Rosa',
    to: 'abuela',
    content: 'I dream in Spanish when I miss you. I cant speak it well anymore and that feels like losing you twice. I should have practiced more when you were still here to correct me.',
  },
  {
    from: 'your brother',
    to: 'Mike',
    content: 'I know we dont talk about feelings. Thats like the one rule we have. But im worried about you man. You dont have to tell me whats wrong. Just let me know youre okay.',
  },
  {
    from: 'Jasmine',
    to: 'mom',
    content: 'You gave up your career so I could have mine. I didnt understand that until I had to choose between a promotion and being there for my kid. I chose what you chose. I get it now.',
  },

  // --- friendship ---
  {
    from: 'your old roommate',
    to: 'Alicia',
    content: 'remember when we ate cereal for dinner for like 3 weeks straight because we were too broke for real food? Those were objectively terrible times but I swear Ive never laughed harder in my life',
  },
  {
    from: 'sorry',
    to: 'the group chat',
    content: 'I know I just stopped responding. I didnt mean to go silent. Depression is weird like that - it convinces you nobody actually wants to hear from you. I miss you guys. Im trying to come back.',
  },
  {
    from: 'Dani',
    to: 'Soph',
    content: 'You always order for me when I freeze up at restaurants. You do it so casually like its nothing. But for someone with anxiety that bad, its everything. Thank you for never making it a thing.',
  },
  {
    from: 'N',
    to: 'my best friend',
    content: 'Youre getting married next month and im so happy for you but also terrified that everything is about to change. I know thats selfish. I know. Im working on it.',
  },
  {
    from: 'Jake',
    to: 'the boys',
    content: 'I cried last night and I dont even know why. Just hit me out of nowhere. I almost called one of you but didnt wanna be weird about it. This is the closest ill get to saying it I guess.',
  },

  // --- love/crush ---
  {
    from: 'nervous wreck',
    to: 'my coworker',
    content: 'You asked me if I wanted to grab lunch and I panicked and said I already ate. I hadnt. I was literally starving. My brain just short circuits around you and I hate it so much.',
  },
  {
    from: 'Alex',
    to: 'the barista',
    content: 'You spelled my name wrong on the cup again. Its fine. At this point its kind of our thing. I come in for the coffee but mostly for the 10 seconds where you smile at me.',
  },
  {
    from: 'still thinking',
    to: 'my ex',
    content: 'I know I said I was over it. I lied. Not about all of it - I dont miss the bad parts. But the way you hummed in the kitchen while making eggs? I miss that every morning.',
  },
  {
    from: 'Mia',
    to: 'Ben',
    content: 'every time our hands accidentally touch I forget what I was saying. Im 28 years old. This is ridiculous. I should be able to form sentences around a boy by now.',
  },
  {
    from: 'anonymous',
    to: 'the person reading this',
    content: 'if someone out there thinks nobody notices them - I notice you. I see you trying. Thats not nothing.',
  },

  // --- regret ---
  {
    from: 'the one who left',
    to: 'everyone at the table',
    content: 'I stormed out of Thanksgiving and never apologized. Three years now. Every November I think about calling but the silence has gotten so big I dont know how to break it.',
  },
  {
    from: 'Liam',
    to: 'Ava',
    content: 'I told you it didnt bother me. It did. I said I was fine with it. I wasnt. By the time I was ready to be honest you already stopped asking.',
  },
  {
    from: 'a bad friend',
    to: 'Clara',
    content: 'I cancelled on you so many times that you stopped inviting me. I dont blame you. But every cancellation was anxiety not apathy. I wanted to come. I just couldnt.',
  },
  {
    from: 'haunted',
    to: 'the last conversation',
    content: 'I ended the call too fast. Said "talk later" instead of "I love you." Didnt know there wouldnt be a later. I think about that every single day.',
  },
  {
    from: 'Miguel',
    to: 'Elena',
    content: 'You asked me to stay and I said I couldnt. The truth is I could have. I was just scared of what staying meant. I picked easy over right and I have to live with that now.',
  },

  // --- loss/grief ---
  {
    from: 'Owen',
    to: 'your voicemail',
    content: 'Its just you saying "hey call me back." Seven words. But its your voice and youre alive in it. I play it when the quiet gets too loud. My phones at 3% and I still wont delete it.',
  },
  {
    from: 'still here',
    to: 'the empty chair',
    content: 'Christmas is the worst. Someone always sits in your spot. Nobody mentions it. But we all feel it.',
  },
  {
    from: 'Chloe',
    to: 'Bear',
    content: 'The vet said you wouldnt feel anything. I hope thats true. You were the best boy and my apartment is so quiet without your snoring. Miss you buddy.',
  },
  {
    from: 'A',
    to: 'grandma',
    content: 'i tried to make your pie for christmas and completely messed it up. burned the crust, filling was runny, the whole thing. but it smelled like your kitchen for a second and i just sat on the floor and cried.',
  },

  // --- growth/healing ---
  {
    from: 'day 847',
    to: 'day 1',
    content: 'You were the worst day of my life. But also the most honest. First time I said "I need help" out loud. Turns out those words dont break you. They build you.',
  },
  {
    from: 'Nora',
    to: 'the old me',
    content: 'I dont recognize you anymore and Im not sad about it. You were surviving. I get that. But Im living now and the difference is everything.',
  },
  {
    from: 'finally okay',
    to: 'anyone struggling',
    content: 'it gets different. i wont say better because thats not always true. but different. you learn to carry it differently. thats enough. i promise thats enough.',
  },
  {
    from: 'Zara',
    to: 'my anxiety',
    content: 'You dont get to drive anymore. I know you think youre protecting me but youre not. You kept me safe by keeping me small and I am done being small. Move over.',
  },

  // --- strangers ---
  {
    from: 'a commuter',
    to: 'bus 47 morning crew',
    content: 'We never talk but I see yall every day. Guy with the thermos. Lady with the crossword. Kid with the giant headphones. Yall are the most consistent thing in my life rn and you dont even know it.',
  },
  {
    from: 'grateful',
    to: 'the uber driver',
    content: 'I was crying in your backseat at 2am and you didnt say a word. You just changed the music to something soft and turned the volume up a little. That was exactly what I needed.',
  },
  {
    from: 'the one who noticed',
    to: 'the dad at the park',
    content: 'Your kid fell and you scooped her up so fast and just held her. No "youre fine" or "stop crying." Just held her while she cried. Thats good parenting. She is lucky.',
  },

  // --- misc/honest ---
  {
    from: 'just being real',
    to: 'my reflection',
    content: 'I dont know who I am without performing for other people. Thats terrifying to admit. But here I am admitting it to a website at 1am so thats something I guess.',
  },
  {
    from: 'Ty',
    to: 'nobody',
    content: 'Im 26 and I still dont know what Im doing. Everyone else seems to have figured it out. Starting to think maybe nobody has and were all just winging it.',
  },
  {
    from: 'honest',
    to: 'my job',
    content: 'I spend 40 hours a week doing something that means nothing to me so I can afford to exist. There has to be more than this. Right?',
  },
  {
    from: 'Kai',
    to: 'the version of me that exists in other peoples heads',
    content: 'Youre way more put together than I am. People describe you and I dont even recognize myself. Must be nice being you.',
  },
  {
    from: 'a night owl',
    to: '3am',
    content: 'youre the only hour thats honest. everything else is performance. but at 3am theres nobody to perform for and the truth just shows up uninvited.',
  },

  // --- more real names, casual ---
  {
    from: 'Rach',
    to: 'Dev',
    content: 'We said wed stay friends. We both knew that was a lie. But it was a nice lie and I think we both needed to believe it for a minute.',
  },
  {
    from: 'Mateo',
    to: 'pops',
    content: 'I got the job. The one you said id never get. Part of me wants to call you. Bigger part of me wants you to hear about it from someone else and wonder what you missed.',
  },
  {
    from: 'Tiff',
    to: 'past me',
    content: 'girl. GIRL. put the phone down. do not send that text. i know you think its a good idea at midnight but it is NOT. love, future you who had to deal with the consequences',
  },
  {
    from: 'your oldest friend',
    to: 'Jess',
    content: 'We used to tell each other everything. Now our conversations are just "haha" and heart reacts on instagram stories. I dont know when that happened but I want it to un-happen.',
  },
  {
    from: 'Wei',
    to: 'my parents',
    content: 'You moved across an ocean so I could have opportunities you never had. I took all of it for granted for so long. Im sorry. Everything I build is because of what you sacrificed.',
  },
  {
    from: 'Andre',
    to: 'Coach',
    content: 'You were the first adult who didnt give up on me. I was testing you. I test everyone. You passed. That changed everything.',
  },
  {
    from: 'Hana',
    to: 'my sister',
    content: 'You got moms eyes and dads confidence and I got whatever was left. I love you but sometimes being your sister feels like standing next to the sun. Everything I am is in your shadow.',
  },
  {
    from: 'Sean',
    to: 'the version of us that worked',
    content: 'Does it exist somewhere? A timeline where I said the right thing and you stayed and we figured it out? I hope so. Even if Im not in it anymore I hope that version of you is happy.',
  },
  {
    from: 'L',
    to: 'you know who you are',
    content: 'Stop pretending everything is fine. I can see through it. Everyone can see through it. Let someone in before you crack. You dont have to do this alone.',
  },

  // --- slightly longer, stream of consciousness ---
  {
    from: 'cant sleep',
    to: 'whoever is up rn',
    content: 'its 4am and im thinking about how everyone i love is going to die someday and how i should probably tell them i love them more often but instead im lying here staring at the ceiling. brains are weird.',
  },
  {
    from: 'your patient',
    to: 'Dr. Kim',
    content: 'You probably dont remember me. I was in your office for like 12 minutes. You said "this isnt your fault" and I hadnt even told you what happened yet. Its been 8 years. I still think about that.',
  },
  {
    from: 'anonymous',
    to: 'the kid I bullied',
    content: 'I was dealing with stuff at home and I took it out on you. That doesnt make it okay. Nothing makes it okay. I think about the look on your face sometimes and it makes me sick. Im sorry.',
  },
  {
    from: 'Nina',
    to: 'the ocean',
    content: 'Mom used to take us to the beach every summer. I can still taste the salt and feel the sunburn. She cant remember my name anymore but I bet she remembers the sound of the waves. I hope she does.',
  },
  {
    from: 'Ryan',
    to: 'Sam',
    content: 'I didnt understand your choices until life put me in the same corner. Im sorry for every raised eyebrow. Every careful silence. You were surviving. I should have seen that.',
  },
  {
    from: 'exhausted',
    to: 'the happy version of me',
    content: 'where did you go? I know you existed at some point. There are photos. I just cant remember what it felt like to be you. If youre still in there somewhere, could you maybe come back?',
  },
  {
    from: 'your neighbor',
    to: 'apartment 4B',
    content: 'I hear you playing piano through the wall most nights. You always stumble on the same part and then start over. Im rooting for you. You almost had it last thursday.',
  },
  {
    from: 'anonymous',
    to: 'this website',
    content: 'I dont know if anyone actually reads these. Probably not. But just typing it out helped. So thanks I guess.',
  },

  // --- batch 2: short messages (all <=120 chars) ---
  {
    from: 'me',
    to: 'you',
    content: 'I rehearsed this message a hundred times. None of the versions were brave enough.',
  },
  {
    from: 'anonymous',
    to: 'my pillow',
    content: 'you know more about me than any living person and thats kind of embarrassing',
  },
  {
    from: 'Jas',
    to: 'R',
    content: 'You said my name different than everyone else. I noticed every time.',
  },
  {
    from: 'your kid',
    to: 'dad',
    content: 'I just wanted you to show up. Thats it. Thats all it would have taken.',
  },
  {
    from: 'me',
    to: 'the one who stayed',
    content: 'Thank you for not leaving when I gave you every reason to.',
  },
  {
    from: 'tired',
    to: 'my brain',
    content: 'Can you please shut up for like five minutes. Im begging you.',
  },
  {
    from: 'anonymous',
    to: 'the moon',
    content: 'I wonder if theyre looking at you too right now.',
  },
  {
    from: 'Dee',
    to: 'past me',
    content: 'You survived that year. I know you didnt think you would. But you did.',
  },
  {
    from: 'honest',
    to: 'anyone',
    content: 'Some days the loneliness is so loud I cant hear anything else.',
  },
  {
    from: 'Cam',
    to: 'the empty seat',
    content: 'I still set the table for two sometimes. Force of habit. Or maybe hope.',
  },
  {
    from: 'sorry',
    to: 'mom',
    content: 'I turned out just like you. I spent my whole life trying not to.',
  },
  {
    from: 'anonymous',
    to: 'my old self',
    content: 'You were so brave. You just didnt know it yet.',
  },
  {
    from: 'V',
    to: 'the quiet ones',
    content: 'The loudest people in the room arent the ones hurting the most. Trust me.',
  },
  {
    from: 'broken',
    to: 'whoever needs this',
    content: 'Youre not too much. You were just around people who werent enough.',
  },
  {
    from: 'me',
    to: 'C',
    content: 'I wrote your number on my hand like it was 2005. Just in case I was brave enough.',
  },
  {
    from: 'Eli',
    to: 'summer 2019',
    content: 'Thats when I was happiest and I didnt even know it.',
  },
  {
    from: 'anonymous',
    to: 'my dog',
    content: 'You cant read this but you saved my life and I need someone to know that.',
  },
  {
    from: 'still here',
    to: 'the version of me that almost gave up',
    content: 'You made it. Its not perfect but youre here. Thats enough.',
  },
  {
    from: 'your friend',
    to: 'Kat',
    content: 'You laugh louder when youre sad. I noticed. I always notice.',
  },
  {
    from: 'Ray',
    to: 'the sunrise',
    content: 'You showed up today even when nobody asked you to. Respect.',
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

  // Get existing messages to avoid duplicates (exact + fuzzy)
  const existing = await getApprovedMessages({ limit: 200 });
  const existingContents = new Set(
    existing.map((m) => m.content.toLowerCase().trim()),
  );
  // Extract first 50 chars of each existing message for fuzzy dedup
  const existingPrefixes = new Set(
    existing.map((m) => m.content.toLowerCase().trim().slice(0, 50)),
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

  // Filter to unused templates (exact match + fuzzy prefix dedup)
  const available = MESSAGE_POOL.filter((t) => {
    const normalized = t.content.toLowerCase().trim();
    if (existingContents.has(normalized)) return false;
    // Fuzzy dedup: skip if the first 50 chars match an existing message
    if (existingPrefixes.has(normalized.slice(0, 50))) return false;
    return true;
  });

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
