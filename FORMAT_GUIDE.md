# Quizmix File Format Guide

This document explains how to create quiz files for Quizmix. The parser reads a plain text file (`quiz_data.txt`) where each question is separated by a double asterisk `**`.

## Core Tags
- `&$T: [Type]` - (Optional but recommended) Specifies the question type.
  - `MC` = Multiple Choice (Default if omitted)
  - `CHECK` = Checkbox (Multiple correct answers)
  - `MATCH` = Matching Type
  - `IDENT` = Identification
  - `BLOCK` = Block Completion
- `&$Q: [Question Text]` - The main question or instruction.
- `&$IMG: [Path]` - (Optional) Path to an image file (e.g., `assets/images/cat.jpg`).
- `&$E: [Explanation Text]` - (Optional) Provides an explanation for the answer, shown via a "Why?" button.
- `&$O: [Option]` - Adds an answer choice or data point. Usage varies by type.
- `**` - Separator between questions.

## Global Metadata (Optional)
Place these at the top of the file before the first question. **You must end the metadata block with `**` just like a question.**
- `&$NAME: [Quiz Title]`
- `&$COURSE: [Course Name]` (e.g., CS101, Web Dev) - categorizes the quiz.
- `&$DESC: [Short Description]`
- `&$SETTING: show_answers=true` (Enables showing correct answer after attempt)

---

## Question Types

### 1. Multiple Choice (MC)
Standard question with one correct answer.
- Mark the separate options with `&$O`.
- Start the **correct** option with `*` (asterisk).

**Example:**
```text
&$T: MC
&$Q: What is the capital of France?
&$O: London
&$O: Berlin
&$O: *Paris
&$O: Madrid
**
```

### 2. Matching Type (MATCH)
Pairs of items to match.
- Each `&$O` line should contain a pair separated by `|`.
- Format: `Left Item | Right Item`

**Example:**
```text
&$T: MATCH
&$Q: Match the country with its capital.
&$O: Japan | Tokyo
&$O: France | Paris
&$O: Italy | Rome
&$O: Germany | Berlin
**
```

### 3. Identification (IDENT)
Type the correct answer.
- `&$O` contains the accepted answer(s).
- You can add multiple `&$O` lines for accepted variations (e.g., "USA", "United States").

**Example:**
```text
&$T: IDENT
&$Q: What implies a function calls itself?
&$O: Recursion
**
```

### 4. Block Completion (BLOCK)
Reorder words to form a correct sentence (duolingo-style).
- `&$O` contains the correct full sentence.
- The game will automatically shuffle the words.

**Example:**
```text
&$T: BLOCK
&$Q: Translate: "The cat eats fish"
&$O: Le chat mange du poisson
**
```
