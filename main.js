function randInt(max) {
    return Math.floor(Math.random() * max);
}

function generateAlphabet() {
    const alphabet = [];
    for (let i = 0; i < 26; i++) {
        alphabet.push(String.fromCharCode('A'.charCodeAt(0) + i));
    }
    return alphabet;
}

class Model {
    numLetters = 8;

    constructor() {
        this.letters = new Set();
        this.dictionary = new Set()
        this.submitted = new Set();
        this.zapped = new Set();

        this.wordLimit = 8;
        this.timeLimit = 120;
        this.locked = false;
    }

    async init() {
        this.letters = this.pickLetters(this.numLetters);
        this.dictionary = await this.fetchDictionary();
    }

    pickLetters(size) {
        let letters = new Set();

        let alphabet = generateAlphabet();
        let vowels = ['A', 'E', 'I', 'O', 'U'];

        for (let i = 0; i < 2; i++) {
            let index = randInt(vowels.length);
            let letter = vowels[index];
            letters.add(letter);
            vowels.splice(index, 1);
            alphabet.splice(alphabet.indexOf(letter), 1);
        }

        for (let i = 2; i < size; i++) {
            let index = randInt(alphabet.length);
            let letter = alphabet[index];
            letters.add(letter);
            alphabet.splice(index, 1);
        }

        return letters;
    }

    async fetchDictionary() {
        console.log("fetching dictionary...");
        let response = await fetch('words.txt');
        let text = await response.text();
        return new Set(text.toUpperCase().split(/\n/));
    }

    submit(submission) {
        if (this.locked) {
            throw new Error("Game is locked.");
        }

        submission = submission.toUpperCase();
        if (submission.length < 3) {
            throw new Error("Must be at least 3 letters long.");
        }

        let submissionLetters = new Set(submission);
        if (submissionLetters.difference(this.letters).size > 0) {
            throw new Error("Invalid letters.");
        }

        if (this.submitted.has(submission)) {
            throw new Error("Already submitted.");
        }

        if (this.zapped.has(submission)) {
            throw new Error("Word was zapped.");
        }

        if (!this.dictionary.has(submission)) {
            throw new Error("Unrecognized word.");
        }

        this.submitted.add(submission);
        if (this.submitted.size == this.wordLimit) {
            this.end();
        }

        return true;
    }

    zap(word) {
        if (!this.submitted.has(word)) {
            return false;
        }

        this.submitted.delete(word);
        this.zapped.add(word);
        return true;
    }

    end() {
        this.locked = true;
    }
}

function parseHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const result = template.content.children;

    // Then return either an HTMLElement or HTMLCollection,
    // based on whether the input HTML had one or more roots.
    if (result.length === 1) return result[0];
    return result;
}


class View extends HTMLElement {
    constructor() {
        super();
        this.model = new Model();
        this.timeLeft = null;
        this.timer = null;
        this.npc = null;

        this.$timer = null;
        this.$letters = null;
        this.$stage = null;
        this.$submitted = null;
        this.$zapped = null;
    }

    async render() {
        await this.model.init();

        // Setup template
        let fragment = parseHTML(`
            <h1>Zapp</h1>
            <div id="timer">Time: ${this.model.timeLimit}</div>
            <ul class="inline" id="letters"></ul>
            <form id="stage">
                <input type="text" placeholder="Word" autocomplete="off">
                <button type="submit">Submit</button>
            </form>

            <ul id="submitted"></ul>
            <ul id="zapped"></ul>`
        );
        this.append(...fragment);

        // Cache elements
        this.$timer = this.querySelector("#timer");
        this.$letters = this.querySelector("#letters");
        this.$stage = this.querySelector("#stage");
        this.$submitted = this.querySelector("#submitted");
        this.$zapped = this.querySelector("#zapped");

        // Setup letters
        this.model.letters.forEach(letter => {
            let li = parseHTML(`<li id="letter-${letter}">${letter}</li>`);
            this.$letters.appendChild(li);
        });

        // Setup form handler
        this.$stage.addEventListener("submit", this.handleSubmit.bind(this));

    }

    async connectedCallback() {
        if (!this.rendered) {
            await this.render();
            this.rendered = true;
        }

        this.startGame();
    }

    startGame() {
        this.timer = this.startTimer();
        this.npc = this.startNPC();

    }

    endGame() {
        // Allow the UI to render before showing the alert
        clearInterval(this.timer);
        clearInterval(this.npc);

        this.$stage.querySelectorAll("input, button").forEach(el => {
            el.disabled = true;
        });

        setTimeout(() => {
            alert("Game over! Total words: " + this.model.submitted.size);
        }, 10);
    }


    startTimer() {
        this.timeLeft = this.model.timeLimit; // seconds
        let timer = setInterval(() => {
            this.timeLeft--;
            this.$timer.textContent = "Timer: " + this.timeLeft;

            if (this.timeLeft <= 0 || this.model.submitted.size >= 10) {
                this.endGame();
            }
        }, 1000);
        return timer;
    }

    startNPC() {
        let npc = setInterval(() => {
            setTimeout(() => {
                if (this.model.submitted.size == 0) {
                    return;
                }

                let i = randInt(this.model.submitted.size);
                let word = [...this.model.submitted][i];
                this.zapWord(word);
            }, randInt(15000)); // Sleep an additional 0-15s
        }, 10000); // At most every 10s
        return npc;
    }

    zapWord(word) {
        if (!this.model.zap(word)) {
            return;
        }

        let $li = this.$submitted.querySelector(`#word-${word}`);
        this.$zapped.appendChild($li);

        console.log("Zapped: " + word);
    }

    handleSubmit(event) {
        event.preventDefault();

        let $input = this.$stage.querySelector("#stage input");
        let word = $input.value.toUpperCase().trim();
        try {
            this.model.submit(word);
            let li = parseHTML(`<li id="word-${word}">${word}</li>`);
            this.$submitted.appendChild(li);
        } catch (e) {
            alert(e.message);
        }

        $input.value = "";

        if (this.model.locked) {
            this.endGame();
        }
    }

}

customElements.define("word-zapp", View);
