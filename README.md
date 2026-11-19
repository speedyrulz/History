# The Archive — *World War II*

A static web page that starts out as an ordinary encyclopedia article about the Second World War and becomes steadily more wrong the further down you read. Psychological horror only: no sounds, no pop-ups, no jump scares.

Open `index.html` in a browser (no build step, no dependencies). It also works as-is on GitHub Pages.

> **Spoilers below.** Read the page first.

<details>
<summary>How it works</summary>

- **Gradual decay.** `script.js` tracks how far you have scrolled between hidden marker elements and blends the page from clean white → aged paper → total blackout. The darkness arrives in a section about wartime *blackout regulations*.
- **Nothing changes while you watch.** Text swaps (`data-swap`) only happen to elements that are off-screen. The sidebar, tabs, search box and logo change once you are deep enough. After you reach the bottom, the top of the article is rewritten to be about *you*. You only find out when you scroll back up.
- **The eighth man.** The first photograph shows seven soldiers, with an eighth figure at about 3% opacity, barely visible. The reprint later on fades him in over about 45 seconds. Once you have seen the reprint, the first photograph quietly shows him too.
- **Hidden things:** acrostics (first letters of paragraphs in *Aftermath* + *Legacy*), text you can only see by selecting it, reference backlinks that spell a phrase, HTML comments, a death register that keeps growing, a second reader who appears, whispers that fade in only when you stop moving, tab titles that change, copy/print messages, and a different hatnote for returning readers.
- **Wordplay:** re-membering / rest in pieces, the fallen (you, scrolling down), enlisted / listed, conscript / written in, draft, missing presumed *read*, morning / mourning, "Lest we forget" read as a warning.

</details>

Real historical content in the early sections is written to be accurate. The horror is centred on memory, remembrance and the reader, not on mocking real victims.
