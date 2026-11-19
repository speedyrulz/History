# The Archive — *World War II*

A static web page that starts out as an ordinary encyclopedia article about the Second World War and becomes steadily more wrong the further down you read. Psychological horror only: no sounds, no pop-ups, no jump scares.

Open `index.html` in a browser (no build step, no dependencies). It also works as-is on GitHub Pages.

> **Spoilers below.** Read the page first.

<details>
<summary>How it works</summary>

- **Gradual decay.** `script.js` tracks how far you have scrolled between hidden marker elements and blends the page from clean white → aged paper → total blackout. The darkness arrives in a section about wartime *blackout regulations*.
- **Nothing changes while you watch.** Text swaps (`data-swap`) only happen to elements that are off-screen. The sidebar, tabs, search box and logo change once you are deep enough. After you reach the bottom, the top of the article is rewritten to be about *you*. You only find out when you scroll back up.
- **The seventh man.** A real 1943 photograph of a B-17 crew shows six men. A seventh, faceless figure has been composited into the shadow under the aircraft at about 7% opacity. The reprint later on fades him in over about 45 seconds; once you have seen it, the first photograph quietly shows him too. After the live editor types *"he isn't in the photograph anymore"*, both copies lose him. When you get back to the top, he is standing right in front of the camera.
- **The page watches you.** A *Reader record* is built from what you actually did on the page: which section you lingered on, how long you looked at the photograph, how many times you scrolled back up to check, whether you found the hidden lines, whether you switched tabs. Nothing is stored or sent anywhere.
- **Someone else is editing.** "2 people are reading this article" appears, then a faint second cursor starts trailing yours, and a "1 other user is editing this section" box types out messages built from your behaviour, typos and all. It ends with *"he only moves when you look away from the screen. so don't."* If you switch tabs after that, "he moved." fades in when you come back.
- **Other details:** the deep sections slowly breathe, the tab icon becomes an eye, and search suggestions turn strange.
- **Hidden things:** acrostics (first letters of paragraphs in *Aftermath* + *Legacy*), text you can only see by selecting it, reference backlinks that spell a phrase, HTML comments, a death register that keeps growing, a second reader who appears, whispers that fade in only when you stop moving, tab titles that change, copy/print messages, and a different hatnote for returning readers.
- **Wordplay:** re-membering / rest in pieces, the fallen (you, scrolling down), enlisted / listed, conscript / written in, draft, missing presumed *read*, morning / mourning, "Lest we forget" read as a warning.

</details>

Real historical content in the early sections is written to be accurate. The horror is centred on memory, remembrance and the reader, not on mocking real victims.

## Photo credits

The photographs come from a public-domain 1943 US Army Air Forces photo on Wikimedia Commons; see [`img/CREDITS.md`](img/CREDITS.md). The extra figure in the crew photograph is a digital composite made for this page and does not appear in the original. The captions in the later sections are fiction.
