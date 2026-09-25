export class Agent {
  static async prompt() {
    return {
      status: 'finished',
      result: JSON.stringify({
        summary: 'mock review',
        findings: [],
      }),
    };
  }
}

export class Cursor {}
