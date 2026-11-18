import { elementsEqual, type BoardChange, type BoardElement } from '../shared/model';

export function changesMatch(elements: ReadonlyMap<string, BoardElement>, changes: BoardChange[]): boolean {
  return changes.every(change => elementsEqual(elements.get(change.id) ?? null, change.before));
}

export function applyChanges(elements: Map<string, BoardElement>, changes: BoardChange[]): void {
  for (const { id, after } of changes) {
    if (after) elements.set(id, after);
    else elements.delete(id);
  }
}

export function reverseChanges(changes: BoardChange[]): BoardChange[] {
  return changes.map(({ id, before, after }) => ({ id, before: after, after: before }));
}

const maxHistory = 100;

type Intent = 'edit' | 'undo' | 'redo';

export interface Transaction {
  id: string;
  changes: BoardChange[];
  intent: Intent;
}

export class TransactionHistory {
  private past: BoardChange[][] = [];
  private future: BoardChange[][] = [];

  candidate(intent: 'undo' | 'redo', elements: ReadonlyMap<string, BoardElement>): BoardChange[] | undefined {
    const source = intent === 'undo' ? this.past : this.future;
    for (let index = source.length - 1; index >= 0; index--) {
      const changes = intent === 'undo' ? reverseChanges(source[index]) : source[index];
      if (changesMatch(elements, changes)) return changes;
    }
    return undefined;
  }

  invalidate(ids: ReadonlySet<string>): void {
    const untouched = (changes: BoardChange[]) => changes.every(change => !ids.has(change.id));
    this.past = this.past.filter(untouched);
    this.future = this.future.filter(untouched);
  }

  accept(transaction: Transaction): void {
    const { changes, intent } = transaction;
    if (intent === 'edit') {
      this.past.push(changes);
      if (this.past.length > maxHistory) this.past.shift();
      this.future.length = 0;
    } else {
      const original = intent === 'undo' ? reverseChanges(changes) : changes;
      const source = intent === 'undo' ? this.past : this.future;
      const index = source.findLastIndex(entry => this.sameChanges(entry, original));
      if (index >= 0) source.splice(index, 1);
      const destination = intent === 'undo' ? this.future : this.past;
      destination.push(original);
    }
  }

  private sameChanges(a: BoardChange[], b: BoardChange[]): boolean {
    return a.length === b.length && a.every((change, index) =>
      change.id === b[index].id && elementsEqual(change.before, b[index].before) &&
      elementsEqual(change.after, b[index].after));
  }
}
