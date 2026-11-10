/* NET Study core: canon, reference parser, passage queries.
 * Shared by the Electron main process (require) and the renderer (script tag). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NETBible = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var OLD = 'old';
  var NEW = 'new';

  var BOOKS = [
    { name: 'Genesis', aliases: ['Gen', 'Ge', 'Gn'], chapters: 50, testament: OLD },
    { name: 'Exodus', aliases: ['Exod', 'Ex', 'Exo'], chapters: 40, testament: OLD },
    { name: 'Leviticus', aliases: ['Lev', 'Le', 'Lv'], chapters: 27, testament: OLD },
    { name: 'Numbers', aliases: ['Num', 'Nu', 'Nm', 'Nb'], chapters: 36, testament: OLD },
    { name: 'Deuteronomy', aliases: ['Deut', 'De', 'Dt'], chapters: 34, testament: OLD },
    { name: 'Joshua', aliases: ['Josh', 'Jos', 'Jsh'], chapters: 24, testament: OLD },
    { name: 'Judges', aliases: ['Judg', 'Jdg', 'Jg'], chapters: 21, testament: OLD },
    { name: 'Ruth', aliases: ['Rth', 'Ru'], chapters: 4, testament: OLD },
    { name: '1 Samuel', aliases: ['1 Sam', '1 Sa', '1 Sm', '1Samuel', 'I Samuel', '1st Samuel'], chapters: 31, testament: OLD },
    { name: '2 Samuel', aliases: ['2 Sam', '2 Sa', '2 Sm', '2Samuel', 'II Samuel', '2nd Samuel'], chapters: 24, testament: OLD },
    { name: '1 Kings', aliases: ['1 Kgs', '1 Ki', '1 Kings', 'I Kings', '1st Kings'], chapters: 22, testament: OLD },
    { name: '2 Kings', aliases: ['2 Kgs', '2 Ki', '2 Kings', 'II Kings', '2nd Kings'], chapters: 25, testament: OLD },
    { name: '1 Chronicles', aliases: ['1 Chr', '1 Ch', '1 Chron', 'I Chronicles', '1st Chronicles'], chapters: 29, testament: OLD },
    { name: '2 Chronicles', aliases: ['2 Chr', '2 Ch', '2 Chron', 'II Chronicles', '2nd Chronicles'], chapters: 36, testament: OLD },
    { name: 'Ezra', aliases: ['Ezr'], chapters: 10, testament: OLD },
    { name: 'Nehemiah', aliases: ['Neh', 'Ne'], chapters: 13, testament: OLD },
    { name: 'Esther', aliases: ['Est', 'Es'], chapters: 10, testament: OLD },
    { name: 'Job', aliases: ['Jb'], chapters: 42, testament: OLD },
    { name: 'Psalms', aliases: ['Ps', 'Psa', 'Psalm', 'Pss', 'Psm'], chapters: 150, testament: OLD },
    { name: 'Proverbs', aliases: ['Prov', 'Pr', 'Pro', 'Prv'], chapters: 31, testament: OLD },
    { name: 'Ecclesiastes', aliases: ['Eccl', 'Ecc', 'Ec', 'Qoh'], chapters: 12, testament: OLD },
    { name: 'Song of Songs', aliases: ['Song of Songs', 'Song of Solomon', 'Song', 'SOS', 'Canticles'], chapters: 8, testament: OLD },
    { name: 'Isaiah', aliases: ['Isa', 'Is'], chapters: 66, testament: OLD },
    { name: 'Jeremiah', aliases: ['Jer', 'Je', 'Jr'], chapters: 52, testament: OLD },
    { name: 'Lamentations', aliases: ['Lam', 'La'], chapters: 5, testament: OLD },
    { name: 'Ezekiel', aliases: ['Ezek', 'Eze', 'Ezk'], chapters: 48, testament: OLD },
    { name: 'Daniel', aliases: ['Dan', 'Da', 'Dn'], chapters: 12, testament: OLD },
    { name: 'Hosea', aliases: ['Hos', 'Ho'], chapters: 14, testament: OLD },
    { name: 'Joel', aliases: ['Jol'], chapters: 3, testament: OLD },
    { name: 'Amos', aliases: ['Am'], chapters: 9, testament: OLD },
    { name: 'Obadiah', aliases: ['Obad', 'Ob'], chapters: 1, testament: OLD },
    { name: 'Jonah', aliases: ['Jon', 'Jnh'], chapters: 4, testament: OLD },
    { name: 'Micah', aliases: ['Mic', 'Mi'], chapters: 7, testament: OLD },
    { name: 'Nahum', aliases: ['Nah', 'Na'], chapters: 3, testament: OLD },
    { name: 'Habakkuk', aliases: ['Hab', 'Hb'], chapters: 3, testament: OLD },
    { name: 'Zephaniah', aliases: ['Zeph', 'Zep', 'Zp'], chapters: 3, testament: OLD },
    { name: 'Haggai', aliases: ['Hag', 'Hg'], chapters: 2, testament: OLD },
    { name: 'Zechariah', aliases: ['Zech', 'Zec', 'Zc'], chapters: 14, testament: OLD },
    { name: 'Malachi', aliases: ['Mal', 'Ml'], chapters: 4, testament: OLD },

    { name: 'Matthew', aliases: ['Matt', 'Mt', 'Mat'], chapters: 28, testament: NEW },
    { name: 'Mark', aliases: ['Mk', 'Mrk', 'Mr'], chapters: 16, testament: NEW },
    { name: 'Luke', aliases: ['Lk', 'Luk'], chapters: 24, testament: NEW },
    { name: 'John', aliases: ['Jn', 'Jhn'], chapters: 21, testament: NEW },
    { name: 'Acts', aliases: ['Ac', 'Act'], chapters: 28, testament: NEW },
    { name: 'Romans', aliases: ['Rom', 'Ro', 'Rm'], chapters: 16, testament: NEW },
    { name: '1 Corinthians', aliases: ['1 Cor', '1 Co', '1Cor', 'I Corinthians', '1st Corinthians'], chapters: 16, testament: NEW },
    { name: '2 Corinthians', aliases: ['2 Cor', '2 Co', '2Cor', 'II Corinthians', '2nd Corinthians'], chapters: 13, testament: NEW },
    { name: 'Galatians', aliases: ['Gal', 'Ga'], chapters: 6, testament: NEW },
    { name: 'Ephesians', aliases: ['Eph', 'Ep'], chapters: 6, testament: NEW },
    { name: 'Philippians', aliases: ['Phil', 'Php', 'Pp'], chapters: 4, testament: NEW },
    { name: 'Colossians', aliases: ['Col', 'Co'], chapters: 4, testament: NEW },
    { name: '1 Thessalonians', aliases: ['1 Thess', '1 Th', '1 Thes', 'I Thessalonians', '1st Thessalonians'], chapters: 5, testament: NEW },
    { name: '2 Thessalonians', aliases: ['2 Thess', '2 Th', '2 Thes', 'II Thessalonians', '2nd Thessalonians'], chapters: 3, testament: NEW },
    { name: '1 Timothy', aliases: ['1 Tim', '1 Ti', '1 Tm', 'I Timothy', '1st Timothy'], chapters: 6, testament: NEW },
    { name: '2 Timothy', aliases: ['2 Tim', '2 Ti', '2 Tm', 'II Timothy', '2nd Timothy'], chapters: 4, testament: NEW },
    { name: 'Titus', aliases: ['Tit', 'Ti'], chapters: 3, testament: NEW },
    { name: 'Philemon', aliases: ['Philem', 'Phm', 'Phile'], chapters: 1, testament: NEW },
    { name: 'Hebrews', aliases: ['Heb', 'He'], chapters: 13, testament: NEW },
    { name: 'James', aliases: ['Jas', 'Ja'], chapters: 5, testament: NEW },
    { name: '1 Peter', aliases: ['1 Pet', '1 Pe', '1 P', 'I Peter', '1st Peter'], chapters: 5, testament: NEW },
    { name: '2 Peter', aliases: ['2 Pet', '2 Pe', '2 P', 'II Peter', '2nd Peter'], chapters: 3, testament: NEW },
    { name: '1 John', aliases: ['1 Jn', '1 Jo', 'I John', '1st John'], chapters: 5, testament: NEW },
    { name: '2 John', aliases: ['2 Jn', '2 Jo', 'II John', '2nd John'], chapters: 1, testament: NEW },
    { name: '3 John', aliases: ['3 Jn', '3 Jo', 'III John', '3rd John'], chapters: 1, testament: NEW },
    { name: 'Jude', aliases: ['Jud', 'Jd'], chapters: 1, testament: NEW },
    { name: 'Revelation', aliases: ['Rev', 'Re', 'Rv', 'Apocalypse'], chapters: 22, testament: NEW }
  ];

  var HIGHLIGHTS = ['#FAD65C', '#8CD19E', '#9EC2F5', '#EDA8C7', '#CCB8F2'];
  var HIGHLIGHT_NAMES = ['Gold', 'Sage', 'Sky', 'Rose', 'Violet'];

  function allAliases(book) {
    var seen = [book.name];
    for (var i = 0; i < book.aliases.length; i++) {
      var a = book.aliases[i];
      if (!seen.some(function (s) { return s.toLowerCase() === a.toLowerCase(); })) seen.push(a);
    }
    return seen;
  }

  function bookNamed(name) {
    var lower = String(name || '').toLowerCase();
    return BOOKS.find(function (b) { return b.name.toLowerCase() === lower; }) || null;
  }

  function clamp(n, lo, hi) { return Math.min(Math.max(n, lo), hi); }

  function normalize(input) {
    return String(input)
      .trim()
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/\u00a0/g, ' ')
      .split(/\s+/)
      .filter(function (s) { return s.length > 0; })
      .join(' ');
  }

  function Reference(book, chapter, verseStart, verseEnd) {
    this.book = book;
    this.chapter = chapter;
    this.verseStart = verseStart == null ? null : verseStart;
    this.verseEnd = verseEnd == null ? null : verseEnd;
  }

  Reference.prototype.display = function () {
    if (this.book.chapters === 1 && this.verseStart != null) {
      var s = this.book.name + ' ' + this.verseStart;
      if (this.verseEnd != null && this.verseEnd !== this.verseStart) s += '-' + this.verseEnd;
      return s;
    }
    var out = this.book.name + ' ' + this.chapter;
    if (this.verseStart != null) {
      out += ':' + this.verseStart;
      if (this.verseEnd != null && this.verseEnd !== this.verseStart) out += '-' + this.verseEnd;
    }
    return out;
  };

  Reference.prototype.apiQuery = function () {
    var base = this.book.name + ' ' + this.chapter;
    if (this.verseStart != null) {
      base += ':' + this.verseStart;
      if (this.verseEnd != null && this.verseEnd !== this.verseStart) base += '-' + this.verseEnd;
    }
    return base;
  };

  Reference.prototype.nextChapter = function () {
    if (this.chapter < this.book.chapters) return new Reference(this.book, this.chapter + 1);
    var i = BOOKS.indexOf(this.book);
    if (i >= 0 && i + 1 < BOOKS.length) return new Reference(BOOKS[i + 1], 1);
    return null;
  };

  Reference.prototype.previousChapter = function () {
    if (this.chapter > 1) return new Reference(this.book, this.chapter - 1);
    var i = BOOKS.indexOf(this.book);
    if (i > 0) {
      var prev = BOOKS[i - 1];
      return new Reference(prev, prev.chapters);
    }
    return null;
  };

  Reference.prototype.key = function () {
    return this.book.name + '|' + this.chapter + '|' + (this.verseStart || 0) + '|' + (this.verseEnd || 0);
  };

  function parseReference(input) {
    var raw = String(input == null ? '' : input).trim();
    if (!raw) return null;

    var normalized = normalize(raw);

    var bestBook = null;
    var bestLength = 0;

    for (var i = 0; i < BOOKS.length; i++) {
      var book = BOOKS[i];
      var aliases = allAliases(book);
      for (var j = 0; j < aliases.length; j++) {
        var alias = normalize(aliases[j]);
        if (!alias) continue;
        if (normalized.slice(0, alias.length) !== alias) continue;
        var remainder = normalized.slice(alias.length);
        var okBoundary = remainder.length === 0 ||
          remainder[0] === ' ' ||
          remainder[0] === ':' ||
          /[0-9]/.test(remainder[0]);
        if (!okBoundary) continue;
        if (alias.length > bestLength) {
          bestLength = alias.length;
          bestBook = book;
        }
      }
    }

    if (!bestBook) return null;

    var rest = normalized.slice(bestLength).trim();
    if (rest.charAt(0) === ':') rest = '1' + rest;

    var chapter = 1;
    var verseStart = null;
    var verseEnd = null;

    // Single-chapter books read "Jude 3" as verse 3, not chapter 3.
    if (bestBook.chapters === 1 && rest.indexOf(':') === -1 && /^[+-]?\d+$/.test(rest)) {
      var only = parseInt(rest, 10);
      if (only > 0) rest = '1:' + only;
    }

    var colon = rest.indexOf(':');
    var chapterPart = colon === -1 ? rest : rest.slice(0, colon);
    var versePart = colon === -1 ? null : rest.slice(colon + 1);

    var chapterDigits = chapterPart.trim();
    if (chapterDigits !== '') {
      if (!/^[+-]?\d+$/.test(chapterDigits)) return null;
      chapter = clamp(parseInt(chapterDigits, 10), 1, bestBook.chapters);
    }

    if (versePart != null) {
      var trimmedVerses = versePart.trim();
      var dash = trimmedVerses.indexOf('-');
      var startText = dash === -1 ? trimmedVerses : trimmedVerses.slice(0, dash);
      var endText = dash === -1 ? null : trimmedVerses.slice(dash + 1);
      if (/^[+-]?\d+$/.test(startText.trim())) {
        verseStart = Math.max(parseInt(startText, 10), 1);
      }
      if (endText != null && /^[+-]?\d+$/.test(endText.trim())) {
        verseEnd = Math.max(parseInt(endText, 10), verseStart == null ? 1 : verseStart);
      }
    }

    return new Reference(bestBook, chapter, verseStart, verseEnd);
  }

  function PassageQuery(raw, kind) {
    this.raw = String(raw);
    this.kind = kind; // 'reference' | 'custom' | 'votd' | 'random'
  }

  PassageQuery.prototype.reference = function () {
    if (this.kind === 'custom' || this.kind === 'votd' || this.kind === 'random') return null;
    return parseReference(this.raw);
  };

  PassageQuery.prototype.title = function () {
    if (this.kind === 'votd') return 'Verse of the Day';
    if (this.kind === 'random') return 'Random Verse';
    var ref = this.reference();
    return ref ? ref.display() : this.raw;
  };

  PassageQuery.prototype.apiPassage = function () {
    if (this.kind === 'votd') return 'votd';
    if (this.kind === 'random') return 'random';
    return this.raw;
  };

  PassageQuery.prototype.isMultiPassage = function () {
    return this.kind === 'custom';
  };

  PassageQuery.verseOfTheDay = function () { return new PassageQuery('votd', 'votd'); };
  PassageQuery.random = function () { return new PassageQuery('random', 'random'); };
  PassageQuery.fromReference = function (ref) { return new PassageQuery(ref.apiQuery(), 'reference'); };

  PassageQuery.userInput = function (text) {
    var trimmed = String(text == null ? '' : text).trim();
    var lower = trimmed.toLowerCase();
    if (lower === 'votd') return PassageQuery.verseOfTheDay();
    if (lower === 'random') return PassageQuery.random();

    var parts = trimmed.split(';').map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
    if (parts.length > 1) {
      var refs = parts.map(parseReference);
      if (refs.every(function (r) { return r != null; })) {
        var joined = refs.map(function (r) { return r.apiQuery(); }).join('; ');
        return new PassageQuery(joined, 'custom');
      }
    }
    return new PassageQuery(trimmed, 'reference');
  };

  // ---- Verse helpers -------------------------------------------------------

  function cleanText(text) {
    return String(text == null ? '' : text)
      .replace(/\u00a0/g, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+\n/g, '\n')
      .trim();
  }

  function verseId(verse) {
    return [verse.bookname, verse.chapter, verse.verse].join('|');
  }

  function verseReference(verse) {
    return verse.bookname + ' ' + verse.chapter + ':' + verse.verse;
  }

  function suggestions(input, limit) {
    var max = limit == null ? 6 : limit;
    var text = String(input == null ? '' : input).trim();
    if (text.length < 1) return [];
    var lower = text.toLowerCase();

    if (parseReference(text) && /\d/.test(text)) return [];

    var starts = BOOKS.filter(function (book) {
      return allAliases(book).some(function (alias) { return alias.toLowerCase().indexOf(lower) === 0; });
    });
    var contains = BOOKS.filter(function (book) {
      return starts.indexOf(book) === -1 && book.name.toLowerCase().indexOf(lower) !== -1;
    });
    return starts.concat(contains).slice(0, max).map(function (b) { return b.name; });
  }

  return {
    BOOKS: BOOKS,
    HIGHLIGHTS: HIGHLIGHTS,
    HIGHLIGHT_NAMES: HIGHLIGHT_NAMES,
    oldTestament: BOOKS.filter(function (b) { return b.testament === OLD; }),
    newTestament: BOOKS.filter(function (b) { return b.testament === NEW; }),
    bookNamed: bookNamed,
    allAliases: allAliases,
    Reference: Reference,
    PassageQuery: PassageQuery,
    parseReference: parseReference,
    suggestions: suggestions,
    cleanText: cleanText,
    verseId: verseId,
    verseReference: verseReference,
    normalize: normalize
  };
});
