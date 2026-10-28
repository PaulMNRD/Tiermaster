import { fitWithin } from './image-resize';

describe('fitWithin', () => {
  it('scales the largest side down to the limit, keeping the ratio', () => {
    expect(fitWithin(4000, 3000, 1024)).toEqual({ width: 1024, height: 768 });
    expect(fitWithin(1000, 5000, 1000)).toEqual({ width: 200, height: 1000 });
  });

  it('never enlarges', () => {
    expect(fitWithin(300, 200, 1024)).toEqual({ width: 300, height: 200 });
  });
});
