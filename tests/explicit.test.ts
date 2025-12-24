
test('simple math', () => {
  expect(2 + 2).toBe(4);
});

describe('Math operations', () => {
  it('should add correctly', () => {
    expect(1 + 1).toBe(2);
  });

  test('should subtract correctly', () => {
    expect(5 - 3).toBe(2);
  });
});
