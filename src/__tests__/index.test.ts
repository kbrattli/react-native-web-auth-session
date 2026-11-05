import { beforeEach, expect, it, jest } from '@jest/globals';

const mockNative = jest.fn<(...args: unknown[]) => Promise<string | null>>();
jest.mock('../NativeWebAuthSession', () => ({
  __esModule: true,
  default: { openAuthSession: (...args: unknown[]) => mockNative(...args) },
}));

const { openAuthSession } = require('../index') as typeof import('../index');

const deferred = () => {
  let resolve!: (url: string | null) => void;
  let reject!: (error: Error) => void;
  mockNative.mockReturnValueOnce(
    new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    })
  );
  return { resolve, reject };
};

beforeEach(() => {
  mockNative.mockReset();
});

it('resolves with the callback URL', async () => {
  mockNative.mockResolvedValueOnce('myapp://cb?code=a%2Bb');
  await expect(openAuthSession('https://a.test', 'myapp')).resolves.toEqual({
    type: 'success',
    url: 'myapp://cb?code=a%2Bb',
  });
  expect(mockNative).toHaveBeenCalledWith('https://a.test', 'myapp', false, null);
});

it.each([null, undefined])(
  'resolves with cancel when the browser closed without a callback (%s)',
  async (missing) => {
    mockNative.mockResolvedValueOnce(missing as null);
    await expect(openAuthSession('https://a.test', 'myapp')).resolves.toEqual({
      type: 'cancel',
    });
  }
);

it('passes the options on', async () => {
  mockNative.mockResolvedValueOnce(null);
  await openAuthSession('https://a.test', 'myapp', {
    preferEphemeralSession: true,
    browserPackages: ['com.android.chrome'],
  });
  expect(mockNative).toHaveBeenCalledWith('https://a.test', 'myapp', true, [
    'com.android.chrome',
  ]);
});

it('joins an open session with the same url and scheme', async () => {
  const session = deferred();
  const first = openAuthSession('https://a.test', 'myapp');
  const second = openAuthSession('https://a.test', 'myapp');
  expect(second).toBe(first);
  session.resolve('myapp://cb');
  await expect(second).resolves.toEqual({ type: 'success', url: 'myapp://cb' });
  expect(mockNative).toHaveBeenCalledTimes(1);
});

it('rejects another url while a session is open, and keeps the open one', async () => {
  const session = deferred();
  const first = openAuthSession('https://a.test', 'myapp');
  await expect(openAuthSession('https://b.test', 'myapp')).rejects.toMatchObject({
    code: 'ALREADY_OPEN',
  });
  expect(openAuthSession('https://a.test', 'myapp')).toBe(first);
  session.resolve(null);
  await first;
  expect(mockNative).toHaveBeenCalledTimes(1);
});

it('opens a new session once the last one settled, also after an error', async () => {
  const session = deferred();
  const first = openAuthSession('https://a.test', 'myapp');
  session.reject(Object.assign(new Error('no browser'), { code: 'NO_BROWSER' }));
  await expect(first).rejects.toMatchObject({ code: 'NO_BROWSER' });
  mockNative.mockResolvedValueOnce(null);
  await expect(openAuthSession('https://a.test', 'myapp')).resolves.toEqual({
    type: 'cancel',
  });
  expect(mockNative).toHaveBeenCalledTimes(2);
});
