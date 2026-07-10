---
name: ask-questions-if-underspecified
description: Use when requirements are vague, incomplete, or ambiguous - ask clarifying questions before proceeding with implementation or investigation
---

# Ask Questions If Underspecified

## Overview

Implementing based on assumptions creates rework. Asking questions first saves time.

**Core principle:** Clarify before you commit. Assumptions are bugs waiting to happen.

**Violating this rule means delivering the wrong thing.**

## The Iron Law

```
NO IMPLEMENTATION WITHOUT CLARIFIED REQUIREMENTS
```

If you don't understand what "done" looks like, you cannot start building.

## When to Use

Use when:
- Task description is 1-2 sentences with no detail
- Key terms are undefined ("handle errors", "optimize", "improve")
- Success criteria are missing
- Multiple interpretations are possible
- Stakeholder/end-user is not identified
- Scope boundaries are unclear
- Dependencies or constraints are not specified

**Use this ESPECIALLY when:**
- You feel the urge to "just start somewhere"
- You're filling in blanks with your own assumptions
- You have multiple design options and don't know which is preferred
- The user says "make it good" or "do what makes sense"

## The Clarification Protocol

### Step 1: Identify Ambiguities

Read the request and list everything that is underspecified:

- **Goal:** What exactly should be accomplished? What's the desired outcome?
- **Scope:** What's in bounds? What's explicitly out of bounds?
- **Users:** Who is this for? What are their needs?
- **Constraints:** Any technical, time, or resource limitations?
- **Preferences:** Any language, framework, style preferences?
- **Definition of Done:** How will we know it's complete?

### Step 2: Ask One Question at a Time

- Ask the SINGLE most important clarifying question first
- Wait for the answer before asking the next question
- Don't dump a list of 10 questions — pace them

### Step 3: Confirm Understanding

After getting answers, restate your understanding concisely:

"To confirm: you want X, with Y constraint, and Z is out of scope. Correct?"

## Red Flags - STOP and Ask Questions

- "I'll assume..." (state your assumption and ask)
- "This probably means..." (verify instead)
- Starting implementation with unclear requirements
- Filling in unspecified details without checking
- Using words like "reasonable", "appropriate", "standard" without definition
- Proposing multiple options when one clear path would suffice

## Examples

### ❌ Bad (assuming)
> User: "Add error handling to the API"
> Agent: "I'll add try-catch blocks and return 500 errors."

### ✅ Good (asking)
> User: "Add error handling to the API"
> Agent: "Can you clarify what kinds of errors you want handled? Client validation, server errors, external service failures? And what should the response format look like?"

## Quick Reference

| Situation | Action |
|-----------|--------|
| 1-sentence task | Ask for details before starting |
| Ambiguous term | Ask for definition |
| Missing success criteria | Ask for definition of done |
| Multiple interpretations | Ask which one is intended |
| No constraints given | Ask about constraints |
| Unclear scope | Ask what's in/out of bounds |
