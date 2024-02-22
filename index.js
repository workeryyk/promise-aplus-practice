const PENDING = "PENDING";
const RESOLVED = "RESOLVED";
const REJECTED = "REJECTED";

const resolvePromise = (promise2, x, resolve, reject) => {
  //判断x 和 peomise2 是不是一样的 ，如果是属于循环引用，抛出异常
  if (x === promise2) {
    return reject(new TypeError("....."));
  }
  //判断x 是普通值还是promise， 如果是promise 需要获取promise的结果向下传递
  if ((typeof x === "object" && x !== null) || typeof x === "function") {
    let called; //内部测试 失败成功都调用
    try {
      const then = x.then; //取then 可能会失败，比如defineproperty
      if (typeof then === "function") {
        then.call(
          //能保证不用再次取then的值
          x,
          (y) => {
            if (called) {
              return;
            }
            called = true;
            //如果y依然是promise，需要递归调用resolvePromise， 取值向下传递
            resolvePromise(promise2, y, resolve, reject); //采用promise成功的结果向下传递
          },
          (r) => {
            if (called) {
              return;
            }
            called = true;
            reject(r); //采用promise失败的结果向下传递
          }
        );
      } else {
        // x 为普通对象
        resolve(x);
      }
    } catch (e) {
      if (called) {
        return;
      }
      called = true;
      reject(e);
    }
  } else {
    //x是一个普通值
    resolve(x);
  }
};

const isPromise = (value) => {
  if ((typeof x === "object" && x !== null) || typeof x === "function") {
    if (typeof value === "function") {
      return true;
    }
  } else {
    return false;
  }
};

class Promise {
  constructor(executor) {
    this.status = PENDING; //初始promise状态

    this.value = undefined; //初始成功回调的值
    this.reason = undefined; //初始失败回调的值

    this.onFulfilledCallBack = []; //成功状态的回调列表
    this.onRejectedCallBack = []; //失败状态的回调列表

    //成功的回调函数
    const resolve = (value) => {
      //只有状态为pending时才能修改状态
      if (this.status === PENDING) {
        this.value = value;
        this.status = RESOLVED;
        //成功状态时调用成功回调列表的函数
        this.onFulfilledCallBack.forEach((fn) => fn());
      }
    };

    //失败的回调函数
    const reject = (reason) => {
      //只有状态为pending时才能修改状态
      if (this.status === PENDING) {
        this.reason = reason;
        this.status = REJECTED;
        //失败状态时调用成功回调列表的函数
        this.onRejectedCallBack.forEach((fn) => fn());
      }
    };

    try {
      executor(resolve, reject);
    } catch (error) {
      //执行报错默认reject
      reject(error);
    }
  }

  //then方法接收两个参数onfulfilled， onrejected
  //then 方法的执行
  //1.then中传递的函数，判断成功和失败函数的返回结果
  //2. 判断是不是promise  如果是promise就采用他的状态
  //3. 如果不是promise，直接传递下去
  then(onfulfilled, onrejected) {
    //onfulfilled, onrejected 是可选参数
    onfulfilled =
      typeof onfulfilled === "function" ? onfulfilled : (data) => data;
    onrejected =
      typeof onrejected === "function"
        ? onrejected
        : (err) => {
            throw err;
          };

    const promise2 = new Promise((resolve, reject) => {
      if (this.status === RESOLVED) {
        //创建宏任务，获取到promise2
        setTimeout(() => {
          //捕获异常
          try {
            const x = onfulfilled(this.value);
            //判断x 是否为promise
            resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        }, 0);
      }
      if (this.status === REJECTED) {
        setTimeout(() => {
          try {
            const x = onrejected(this.reason);
            resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        }, 0);
      }
      //异步执行时状态为pending时需要缓存 成功和失败回调，在更改pending状态时执行
      if (this.status === PENDING) {
        this.onFulfilledCallBack.push(() => {
          setTimeout(() => {
            try {
              const x = onfulfilled(this.value);
              resolvePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          }, 0);
        });

        this.onRejectedCallBack.push(() => {
          setTimeout(() => {
            try {
              const x = onrejected(this.reason);
              resolvePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          }, 0);
        });
      }
    });

    //then执行之后的返回值应该是一个promise实现链式调用
    return promise2;
  }
}

//全部成功按顺序返回， 一个失败最终结果为失败
Promise.all = function (values) {
  return new Promise((resolve, reject) => {
    const resArr = [];
    let index = 0; //解决多个异步并发问题需要用到计数器
    //保证执行结果按顺序返回
    const processData = (key, value) => {
      resArr[key] = value;
      if (++index === resArr.length) {
        resolve(resArr);
      }
    };
    for (let i = 0; i < values.length; i++) {
      const current = values[i];
      if (isPromise(current)) {
        current.then((data) => {
          processData(i, data);
        }, reject);
      } else {
        processData(i, current);
      }
    }
  });
};

Promise.resolve = (value) => {
  return new Promise((resolve, reject) => {
    resolve(value);
  });
};

Promise.reject = (reason) => {
  return new Promise((resolve, reject) => {
    reject(reason);
  });
};

Promise.prototype.finally = function (cb) {
  return this.then(
    (value) => {
      Promise.resolve(cb()).then(() => value);
    },
    (reason) => {
      Promise.reject(cb()).then(() => {
        throw reason;
      });
    }
  );
};
//第一个有结果的作为最终结果
Promise.race = (arr) => {
  return new Promise((resolve, reject) => {
    if (!(arr instanceof Array)) reject(new Error("Invalid Array"));
    arr.forEach((item) => {
      if (Promise.isPromise(item)) {
        item.then(
          (value) => {
            resolve(value);
          },
          (reason) => {
            reject(reason);
          }
        );
      } else {
        resolve(item);
      }
    });
  });
};

module.exports = Promise;

Promise.defer = Promise.deferred = function () {
  let dfd = {};
  dfd.promise = new Promise((resolve, reject) => {
    dfd.resolve = resolve;
    dfd.reject = reject;
  });
  return dfd;
};
