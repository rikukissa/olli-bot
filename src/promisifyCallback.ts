type Callback<T> = (data: T) => void;

export function promisifyCallback<T>(
  fn: (event: string, callback: Callback<T>) => void
) {
  return (event: string): Promise<T> => {
    return new Promise(resolve => {
      fn(event, (data: T) => resolve(data));
    });
  };
}
