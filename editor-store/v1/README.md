# Editor store

## Overview

Make instances portable with the editor store so you can: 

- Enable drag-and-drop interfaces in your app
- Dispatch commands or add data to an `editor` from anywhere  
- Pluck data from an instance on the fly in order to submit form and other data

## Philosophy

True portability means storing `editor` instances *and* their history.

This is the only way to keep the instance's undo and redo history intact. I add both to the store through the the `EditorStorePlugin` as new instances are created. 

Note: I'll mount the `HistoryPlugin` for you. Don't add it yourself! 

- The editor store is just a plain object. 
- `Editors` are keyed onto it by `namespace`.

One of Lexical’s great strengths is that it exists outside React. 

This means that React does not re-render whenever a change is made to the `editor`. As a result, I store the store in a ref, not React state. My only concern with this is accidental mutation, so I only pass getters and setters out of the store.  

There are two Lexical quirks to understand when making editors portable:

- During an an active session, you must always pass an existing `editor` instance to newly mounting `LexicalComposers` via their `editor__DEPRECATED` property. There is no other way to preserve history at this time.
- When remounting an instance, you'll want to stop Lexical from adding a new entry to the `undoStack` for the “initializing” editor. This is done by *merging* it with the current entry. Don’t worry — the `EditorStorePlugin` does this for you.

## Guides

### Setup

- Copy the `EditorStore` files into your project.
- Put the `EditorStore` wherever you want your store's context to start.
- Make the `EditorStorePlugin` a child of participating `LexicalComposers`. 
- Make the `NestedEditorStorePlugin` a child of participating `LexicalNestedComposers`. 
- Use the `useEditorStore` hook to access store records.

## API highlights

#### `getEditor`

  Pass a namespace to get an `editor` out of the store. 

#### `getHistory`

  Pass a namespace to get an `editor’s` `historyState` out of the store (rarely used).

#### `getKeychain`

  Get a list of all existing `editor` records by key (AKA, `editor` namespace).

#### `getRecord`

  Pass a namespace to get an `editor` and its `historyState` out of the store.

#### `addRecord`

  Pass a namespace, `editor`, and `historyState` to create a new store record (handled by the `EditorStorePlugin` in almost all cases).

#### `deleteRecord`

  Pass a namespace to delete a record — `editor` and `historyState` — from the store. 

#### `resetStore`

  Delete all store records.

--
```
Author: James Abels
Contact: See main README
```