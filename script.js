// SPDX-FileCopyrightText: 2021 Benedict Harcourt <ben.harcourt@harcourtprogramming.co.uk>
//
// SPDX-License-Identifier: BSD-2-Clause

"use strict";

import { elemGenerator, documentFragment } from "https://javajawa.github.io/elems.js/elems.js";

const div  = elemGenerator("div");
const span = elemGenerator("span");

function array(length, callback) {
	return new Array(length).fill(null).map(callback);
}

class GameState {
	constructor(language, keyboardLayout, wordLength) {
		this.language       = language;
		this.keyboardLayout = keyboardLayout;
		this.wordLength     = wordLength;

		this.targetWord = null;
		this.validChars = [];
		this.wordList   = [];

		window.addEventListener("keyup", e => this.keypress(e));
		window.addEventListener("animationend", e => this.animationFlip(e));

		document.getElementById("victory").appendChild(this.resetButton());
	}

	async load() {
		window.localStorage.setItem("config", JSON.stringify({
			language: this.language,
			keyboard: this.keyboardLayout,
			length: this.wordLength,
		}));

		const config = await Promise.all([
			this.loadKeyboard(this.language, this.keyboardLayout),
			this.loadWords(),
			this.createGrid(),
			this.loadStats()
		]);

		this.validChars = config[0];
		this.wordList   = config[1];

		this.resetBoard();
	}

	async loadKeyboard(language, layout) {
		return fetch(`${language}/${layout}.json`)
		.then(r => r.json())
		.then(lines => {
			const keyboard = document.getElementById("keyboard");

			while (keyboard.lastChild) {
				keyboard.removeChild(keyboard.lastChild);
			}

			keyboard.appendChild(documentFragment(
				lines.map(line => div({"class": "line"}, line.map(this.keycap.bind(this)))),
				div({"class": "line"}, this.resetButton()),
			))

			return lines.flat();
		});
	}

	async createGrid() {
		const grid = document.getElementById("grid");

		while (grid.lastChild) {
			grid.removeChild(grid.lastChild);
		}

		grid.appendChild(documentFragment(
			array(this.guessLimit, () => div(
				{"class": "line"},
				array(
					this.wordLength,
					() => div({"class": "tile"})
				),
			))
		));
	}

	async loadWords() {
		return fetch(`${this.language}/length${this.wordLength}.json`)
		.then(r => r.json())
	}

	async loadStats() {
		this.stats = {
			wins: 0,
			defeats: 0,
			after: Object.fromEntries(array(this.guessLimit, (v, i) => [i+1, 0]))
		}

	 	const oldStats = window.localStorage.getItem(this.config);

		if (!oldStats) {
			console.log("no old stats");
			return;
		}

		const oldData = JSON.parse(oldStats);

		if (!oldData) {
			return;
		}

		this.stats.wins = oldData.wins || 0;
		this.stats.defeats = oldData.defeats || 0;

		Object.keys(this.stats.after).forEach(k => {
			if (oldData?.after?.hasOwnProperty(k)) {
				this.stats.after[k] = oldData.after[k];
			}
		});

		console.log(this.stats);
	}

	keycap(c) {
		if (c === "\n") {
			return div({"class": "keycap wide", click: this.handleEnter.bind(this)}, "Enter");
		}

		if (c === "\t") {
			return div({"class": "keycap wide", click: this.handleBackspace.bind(this)}, "Bksp");
		}

		return div({"class": "keycap", id: c, click: () => this.handleChar(c)}, c)
	}

	resetButton() {
		return div(
			{"class": "keycap wide", click: () => this.resetBoard()},
			"New Word"
		);
	}

	resetBoard() {
		this.targetWord = this.wordList[Math.floor(Math.random() * this.wordList.length)];
		document.getElementById("victory").classList.add("hidden");

		document.querySelectorAll('#keyboard .keycap').forEach(e => {
			e.classList.remove("correct");
			e.classList.remove("partial");
			e.classList.remove("absent");
		});

		document.querySelectorAll(".line.checked").forEach(e => {
			e.classList.remove("checked");
		});

		let i = 0;
		document.querySelectorAll('.tile').forEach(e => {
			if (e.textContent == "") return;
			++i;
			setTimeout(() => e.classList.add("animation-clear-out"), i * 10);
		});
	}

	getCurrentAnswerLine() {
		return document.querySelector("#grid>.line:not(.checked)");
	}

	keypress(e) {
		if (e.code == "Enter") {
			return this.handleEnter();
		}
		if (e.code === "Backspace" || e.code === "Delete") {
			return this.handleBackspace();
		}

		if (this.validChars.includes(e.key)) {
			if (e.ctrlKey || e.altKey || e.metaKey) {
				return;
			}
			return this.handleChar(e.key);
		}

		console.log(e.keyCode, e);
	}

	handleEnter() {
		const currentAnswer = this.getCurrentAnswerLine();

		if (!currentAnswer) {
			console.warn("Doing nothing for [Enter] when out of guesses");
			return;
		}

		if (currentAnswer.textContent.length !== this.wordLength) {
			console.warn("Doing nothing for [Enter] when not all letters filled");
			return;
		}

		if (!this.wordList.includes(currentAnswer.textContent)) {
			currentAnswer.classList.add("animation-wobble");
			return;
		}

		currentAnswer.classList.add("checked");
		[...currentAnswer.children].map((elem, i) => setTimeout(
			() => elem.classList.add("animation-down"), i * 50
		));

		if (currentAnswer.textContent === this.targetWord) {
			this.showVictory();
			return;
		}

		if (!this.getCurrentAnswerLine()) {
			this.showDefeat();
		}
	}

	handleBackspace() {
		const currentAnswer = this.getCurrentAnswerLine();

		if (!currentAnswer) {
			console.warn("Doing nothing for backspace when out of guesses");
			return;
		}

		if (currentAnswer.textContent.length === 0) {
			console.warn("Doing nothing for backspace when no letters filled");
			return;
		}

		currentAnswer.children[currentAnswer.textContent.length - 1].textContent = null;
	}

	handleChar(character) {
		const currentAnswer = this.getCurrentAnswerLine();

		if (!currentAnswer) {
			console.warn("Doing nothing for keypress when out of guesses");
			return;
		}

		if (currentAnswer.textContent.length >= this.wordLength) {
			console.warn("Doing nothing for keypress when all letters filled");
			return;
		}

		currentAnswer.children[currentAnswer.textContent.length].textContent = character;
	}

	animationFlip(e) {
		const elem = e.target;

		elem.classList.remove("animation-" + e.animationName);

		if (e.animationName === "clear-out") {
			elem.classList.remove("correct");
			elem.classList.remove("partial");
			elem.classList.remove("absent");
			elem.textContent = null;

			elem.classList.add("animation-clear-back");
		}

		if (e.animationName === "down") {
			const row = elem.parentElement;
			const position  = Array.prototype.indexOf.call(row.children, elem);

			elem.classList.add(this.getGuessState(row.textContent)[position]);
			elem.classList.add("animation-up");
		}
	}

	getGuessState(line) {
		const currentAnswer = line.split("");
		const target = this.targetWord.split("");

		let state = array(this.wordLength, () => "absent");

		for (let i = 0; i < this.wordLength; ++i) {
			if (currentAnswer[i] != target[i]) {
				continue;
			}
			state[i] = "correct";
			target[i] = "";
		}

		for (let i = 0; i < this.wordLength; ++i) {
			if (state[i] == "correct") {
				continue;
			}
			if (target.indexOf(currentAnswer[i]) === -1) {
				continue;
			}

			state[i] = "partial";
			target[target.indexOf(currentAnswer[i])] = "";
		}

		return state;
	}

	showVictory() {
		const guesses = document.querySelectorAll(".line.checked").length;

		document.getElementById("victory_message").textContent =
			"Congrats! You guessed '" + this.targetWord + "' using " + guesses + " guesses!";

		this.stats.wins++;
		this.stats.after[guesses]++;
		this.showStats();
	}

	showDefeat() {
		document.getElementById("victory_message").textContent =
			"You are out of guesses. The correct word was: " + this.targetWord;

		this.stats.defeats++;
		this.showStats();
	}

	showStats() {
		const stats = document.getElementById("victory_stats");
		const played = this.stats.wins + this.stats.defeats;

		window.localStorage.setItem(this.config, JSON.stringify(this.stats));

		while (stats.lastChild) {
			stats.removeChild(stats.lastChild);
		}

		stats.appendChild(documentFragment(
			div(
				{"class": "stat", "style": `width: ${300 * this.stats.wins / played}px`},
				"Wins: " + this.stats.wins
			),
			Object.entries(this.stats.after).map(stat =>
				div({"class": "stat", "style": `width: ${300 * stat[1] / played}px`}, stat[1].toString())
			)
		));

		document.getElementById("victory").classList.remove("hidden");
	}

	get guessLimit()
	{
		return this.wordLength + 1;
	}

	get config()
	{
		return this.language + this.wordLength.toString();
	}
}


function changeLanguage(e) {
	const language = e.target.getAttribute("data-lang");

	document.querySelectorAll("#lang .correct").forEach(e => e.classList.remove("correct"));
	e.target.classList.add("correct");

	game.language = language;
	game.load();
}

function changeLength(e) {
	const wordLength = e.target.getAttribute("data-len");

	document.querySelectorAll("#len .correct").forEach(e => e.classList.remove("correct"));
	e.target.classList.add("correct");

	game.wordLength = parseInt(wordLength);
	game.load();
}

function init() {
	const defaults = window.localStorage.getItem("config") || '{}';
	const settings = JSON.parse(defaults);
	const language = settings.language || "en";
	const keyboard = settings.keyboard || "qwerty";
	const length   = settings.length || 5;

	document.getElementById("settings").appendChild(div(
		{"class": "line", "id": "lang"},
		div({"class": "keycap wide", click: changeLanguage, "data-lang": "en"}, "English")
	));

	document.getElementById("settings").appendChild(div(
		{"class": "line", "id": "len"},
		div({"class": "keycap", click: changeLength, "data-len": "4"}, "4"),
		div({"class": "keycap", click: changeLength, "data-len": "5"}, "5"),
		div({"class": "keycap", click: changeLength, "data-len": "6"}, "6"),
		div({"class": "keycap", click: changeLength, "data-len": "7"}, "7"),
		div({"class": "keycap", click: changeLength, "data-len": "8"}, "8"),
	));

	document.querySelector(`#lang [data-lang="${language}"]`).classList.add("correct");
	document.querySelector(`#len [data-len="${length}"]`).classList.add("correct");

	window.game = new GameState(language, keyboard, length);
	window.game.load();
}

init();
