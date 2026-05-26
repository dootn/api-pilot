export type ArgSpec = {
  name: string;
  placeholder: string;
  type?: 'text' | 'number';
  width?: 'sm' | 'md' | 'lg';
  optional?: true;
  /** Space-separated multi-token field — passed raw without quoting the whole value. */
  multi?: true;
  /** Keyword to prepend before the value (e.g. 'MATCH' for SCAN). */
  keyword?: string;
};

export type CmdSpec = {
  cmd: string;
  args: ArgSpec[];
  /** Brief bilingual description shown in the command builder. */
  desc?: { en: string; zh: string };
};

export type CategoryId = 'General' | 'String' | 'Hash' | 'List' | 'Set' | 'ZSet';

export interface CategoryDef {
  id: CategoryId;
  label: string;
  color: string;
  cmds: CmdSpec[];
}

export const REDIS_CATEGORIES: CategoryDef[] = [
  {
    id: 'General',
    label: 'General',
    color: '#9e9e9e',
    cmds: [
      { cmd: 'PING', args: [], desc: { en: 'Check server connectivity — returns PONG', zh: '检测服务器连通性 — 返回 PONG' } },
      { cmd: 'INFO', args: [{ name: 'section', placeholder: 'server', optional: true, width: 'md' }], desc: { en: 'Get server info & stats (sections: server, clients, memory, stats, replication, cpu, keyspace…)', zh: '获取服务器信息与统计（可选分段：server / clients / memory / stats / replication / cpu / keyspace…）' } },
      { cmd: 'DBSIZE', args: [], desc: { en: 'Return the total number of keys in the current database', zh: '返回当前数据库中的 key 总数' } },
      { cmd: 'KEYS', args: [{ name: 'pattern', placeholder: '*', width: 'md' }], desc: { en: 'Find keys matching a glob pattern — avoid on large DBs, prefer SCAN', zh: '按 glob 模式查找 key —— 大型数据库请避免使用，推荐改用 SCAN' } },
      {
        cmd: 'SCAN',
        desc: { en: 'Iterate keys incrementally; returns a cursor + batch of matching keys', zh: '增量迭代 key，返回游标及本次匹配的 key 列表' },
        args: [
          { name: 'cursor', placeholder: '0', width: 'sm' },
          { name: 'pattern', placeholder: '*', optional: true, width: 'md', keyword: 'MATCH' },
          { name: 'count', placeholder: '10', type: 'number', optional: true, width: 'sm', keyword: 'COUNT' },
        ],
      },
      { cmd: 'TYPE', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Return the data type of a key (string / hash / list / set / zset)', zh: '返回 key 的数据类型（string / hash / list / set / zset）' } },
      { cmd: 'TTL', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Get remaining TTL in seconds (−1 = no expiry, −2 = key missing)', zh: '获取 key 的剩余过期时间（秒）；−1 = 永不过期，−2 = key 不存在' } },
      { cmd: 'PTTL', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Get remaining TTL in milliseconds', zh: '获取 key 的剩余过期时间（毫秒）' } },
      {
        cmd: 'EXPIRE',
        desc: { en: 'Set a timeout on a key in seconds; the key is auto-deleted after expiry', zh: '为 key 设置过期时间（秒），过期后自动删除' },
        args: [
          { name: 'key', placeholder: 'key', width: 'md' },
          { name: 'seconds', placeholder: '60', type: 'number', width: 'sm' },
        ],
      },
      { cmd: 'PERSIST', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Remove the expiry from a key, making it persistent', zh: '移除 key 的过期时间，使其永久保留' } },
      { cmd: 'DEL', args: [{ name: 'key(s)', placeholder: 'key1 key2 …', width: 'lg', multi: true }], desc: { en: 'Delete one or more keys; returns the number of keys deleted', zh: '删除一个或多个 key，返回成功删除的数量' } },
      { cmd: 'EXISTS', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Returns 1 if the key exists, 0 otherwise', zh: '返回 1 表示 key 存在，0 表示不存在' } },
      {
        cmd: 'RENAME',
        desc: { en: 'Rename a key to a new name; fails if source key does not exist', zh: '将 key 重命名为新名称；源 key 不存在时报错' },
        args: [
          { name: 'key', placeholder: 'key', width: 'md' },
          { name: 'newkey', placeholder: 'newkey', width: 'md' },
        ],
      },
      { cmd: 'RANDOMKEY', args: [], desc: { en: 'Return a random key from the database, or nil if empty', zh: '从数据库随机返回一个 key，数据库为空时返回 nil' } },
      { cmd: 'SELECT', args: [{ name: 'db', placeholder: '0', type: 'number', width: 'sm' }], desc: { en: 'Switch to a different database index (0–15)', zh: '切换到指定数据库（0–15）' } },
    ],
  },
  {
    id: 'String',
    label: 'String',
    color: '#ce9178',
    cmds: [
      { cmd: 'GET', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Get the string value stored at a key', zh: '获取 key 存储的字符串值' } },
      {
        cmd: 'SET',
        desc: { en: 'Set the string value of a key (creates or overwrites)', zh: '设置 key 的字符串值（不存在则创建，已有则覆盖）' },
        args: [
          { name: 'key', placeholder: 'key', width: 'md' },
          { name: 'value', placeholder: 'value', width: 'lg' },
        ],
      },
      {
        cmd: 'SETNX',
        desc: { en: 'Set value only if the key does not already exist (Set if Not eXists)', zh: '仅在 key 不存在时设置其值（Set if Not eXists）' },
        args: [
          { name: 'key', placeholder: 'key', width: 'md' },
          { name: 'value', placeholder: 'value', width: 'md' },
        ],
      },
      {
        cmd: 'GETSET',
        desc: { en: 'Atomically set a new value and return the previous value', zh: '原子性地设置新值并返回旧值' },
        args: [
          { name: 'key', placeholder: 'key', width: 'md' },
          { name: 'value', placeholder: 'value', width: 'md' },
        ],
      },
      { cmd: 'GETDEL', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Return the value and delete the key in one atomic operation', zh: '原子性地返回值并删除 key' } },
      { cmd: 'MGET', args: [{ name: 'keys', placeholder: 'key1 key2 …', width: 'lg', multi: true }], desc: { en: 'Get values of multiple keys in a single call', zh: '一次获取多个 key 的值' } },
      { cmd: 'INCR', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Atomically increment the integer value of a key by 1', zh: '将 key 的整数值原子性加 1' } },
      {
        cmd: 'INCRBY',
        desc: { en: 'Increment the integer value of a key by N', zh: '将 key 的整数值加 N' },
        args: [
          { name: 'key', placeholder: 'key', width: 'md' },
          { name: 'by', placeholder: '1', type: 'number', width: 'sm' },
        ],
      },
      { cmd: 'DECR', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Atomically decrement the integer value of a key by 1', zh: '将 key 的整数值原子性减 1' } },
      {
        cmd: 'DECRBY',
        desc: { en: 'Decrement the integer value of a key by N', zh: '将 key 的整数值减 N' },
        args: [
          { name: 'key', placeholder: 'key', width: 'md' },
          { name: 'by', placeholder: '1', type: 'number', width: 'sm' },
        ],
      },
      {
        cmd: 'APPEND',
        desc: { en: 'Append a string to the end of a key; returns the new byte length', zh: '在 key 末尾追加字符串，返回追加后的字节长度' },
        args: [
          { name: 'key', placeholder: 'key', width: 'md' },
          { name: 'value', placeholder: 'value', width: 'md' },
        ],
      },
      { cmd: 'STRLEN', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Return the byte length of the string value', zh: '返回字符串值的字节长度' } },
    ],
  },
  {
    id: 'Hash',
    label: 'Hash',
    color: '#4ec9b0',
    cmds: [
      {
        cmd: 'HGET',
        desc: { en: 'Get the value of a single field in a hash', zh: '获取 hash 中指定字段的值' },
        args: [
          { name: 'key', placeholder: 'key', width: 'md' },
          { name: 'field', placeholder: 'field', width: 'md' },
        ],
      },
      {
        cmd: 'HSET',
        desc: { en: 'Set one field-value pair in a hash (creates the hash if needed)', zh: '设置 hash 中一个字段的值（hash 不存在时自动创建）' },
        args: [
          { name: 'key', placeholder: 'key', width: 'sm' },
          { name: 'field', placeholder: 'field', width: 'sm' },
          { name: 'value', placeholder: 'value', width: 'lg' },
        ],
      },
      {
        cmd: 'HMGET',
        desc: { en: 'Get values of multiple hash fields at once', zh: '一次获取 hash 多个字段的值' },
        args: [
          { name: 'key', placeholder: 'key', width: 'sm' },
          { name: 'fields', placeholder: 'field1 field2 …', width: 'lg', multi: true },
        ],
      },
      { cmd: 'HGETALL', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Get all field-value pairs in a hash', zh: '获取 hash 中所有字段及对应值' } },
      {
        cmd: 'HDEL',
        desc: { en: 'Delete one or more fields from a hash', zh: '删除 hash 中一个或多个字段' },
        args: [
          { name: 'key', placeholder: 'key', width: 'sm' },
          { name: 'field(s)', placeholder: 'field1 field2 …', width: 'md', multi: true },
        ],
      },
      { cmd: 'HKEYS', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Return all field names in a hash', zh: '返回 hash 的所有字段名' } },
      { cmd: 'HVALS', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Return all values in a hash', zh: '返回 hash 的所有值' } },
      { cmd: 'HLEN', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Return the number of fields in a hash', zh: '返回 hash 的字段数量' } },
      {
        cmd: 'HEXISTS',
        desc: { en: 'Check whether a field exists in a hash (returns 1 or 0)', zh: '检查 hash 中是否存在指定字段（返回 1 或 0）' },
        args: [
          { name: 'key', placeholder: 'key', width: 'md' },
          { name: 'field', placeholder: 'field', width: 'md' },
        ],
      },
      {
        cmd: 'HINCRBY',
        desc: { en: "Increment a hash field's integer value by N", zh: '将 hash 字段的整数值加 N' },
        args: [
          { name: 'key', placeholder: 'key', width: 'sm' },
          { name: 'field', placeholder: 'field', width: 'sm' },
          { name: 'by', placeholder: '1', type: 'number', width: 'sm' },
        ],
      },
    ],
  },
  {
    id: 'List',
    label: 'List',
    color: '#569cd6',
    cmds: [
      {
        cmd: 'LPUSH',
        desc: { en: 'Insert values at the head (left) of a list', zh: '向列表头部（左端）插入一个或多个值' },
        args: [
          { name: 'key', placeholder: 'key', width: 'sm' },
          { name: 'value(s)', placeholder: 'v1 v2 …', width: 'lg', multi: true },
        ],
      },
      {
        cmd: 'RPUSH',
        desc: { en: 'Append values at the tail (right) of a list', zh: '向列表尾部（右端）追加一个或多个值' },
        args: [
          { name: 'key', placeholder: 'key', width: 'sm' },
          { name: 'value(s)', placeholder: 'v1 v2 …', width: 'lg', multi: true },
        ],
      },
      { cmd: 'LPOP', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Remove and return the first (leftmost) element of a list', zh: '移除并返回列表第一个（最左）元素' } },
      { cmd: 'RPOP', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Remove and return the last (rightmost) element of a list', zh: '移除并返回列表最后一个（最右）元素' } },
      {
        cmd: 'LRANGE',
        desc: { en: 'Return elements in an index range (use 0 and −1 for all elements)', zh: '返回指定索引范围内的元素（0 和 −1 表示全部）' },
        args: [
          { name: 'key', placeholder: 'key', width: 'sm' },
          { name: 'start', placeholder: '0', type: 'number', width: 'sm' },
          { name: 'stop', placeholder: '-1', type: 'number', width: 'sm' },
        ],
      },
      { cmd: 'LLEN', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Return the number of elements in a list', zh: '返回列表的元素数量' } },
      {
        cmd: 'LINDEX',
        desc: { en: 'Get an element by its index (0 = first, −1 = last)', zh: '按索引获取元素（0 = 第一个，−1 = 最后一个）' },
        args: [
          { name: 'key', placeholder: 'key', width: 'md' },
          { name: 'index', placeholder: '0', type: 'number', width: 'sm' },
        ],
      },
      {
        cmd: 'LSET',
        desc: { en: 'Replace the element at a specific index with a new value', zh: '将指定索引处的元素替换为新值' },
        args: [
          { name: 'key', placeholder: 'key', width: 'sm' },
          { name: 'index', placeholder: '0', type: 'number', width: 'sm' },
          { name: 'value', placeholder: 'value', width: 'md' },
        ],
      },
      {
        cmd: 'LREM',
        desc: { en: 'Remove N occurrences of value (count > 0 from head, < 0 from tail, 0 = all)', zh: '移除 N 个匹配元素（count > 0 从头，< 0 从尾，0 = 全部）' },
        args: [
          { name: 'key', placeholder: 'key', width: 'sm' },
          { name: 'count', placeholder: '0', type: 'number', width: 'sm' },
          { name: 'value', placeholder: 'value', width: 'md' },
        ],
      },
    ],
  },
  {
    id: 'Set',
    label: 'Set',
    color: '#c586c0',
    cmds: [
      {
        cmd: 'SADD',
        desc: { en: 'Add one or more members to an unordered set', zh: '向无序集合中添加一个或多个成员' },
        args: [
          { name: 'key', placeholder: 'key', width: 'sm' },
          { name: 'member(s)', placeholder: 'mem1 mem2 …', width: 'lg', multi: true },
        ],
      },
      { cmd: 'SMEMBERS', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Return all members of a set (unordered)', zh: '返回集合中的所有成员（无序）' } },
      {
        cmd: 'SREM',
        desc: { en: 'Remove one or more members from a set', zh: '从集合中删除一个或多个成员' },
        args: [
          { name: 'key', placeholder: 'key', width: 'sm' },
          { name: 'member(s)', placeholder: 'mem1 mem2 …', width: 'md', multi: true },
        ],
      },
      { cmd: 'SCARD', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Return the number of members in a set', zh: '返回集合的成员数量' } },
      {
        cmd: 'SISMEMBER',
        desc: { en: 'Test whether a value is a member of a set (returns 1 or 0)', zh: '检测值是否为集合成员（返回 1 或 0）' },
        args: [
          { name: 'key', placeholder: 'key', width: 'md' },
          { name: 'member', placeholder: 'member', width: 'md' },
        ],
      },
      { cmd: 'SUNION', args: [{ name: 'keys', placeholder: 'key1 key2 …', width: 'lg', multi: true }], desc: { en: 'Return the union of multiple sets (all unique members)', zh: '返回多个集合的并集（所有不重复成员）' } },
      { cmd: 'SINTER', args: [{ name: 'keys', placeholder: 'key1 key2 …', width: 'lg', multi: true }], desc: { en: 'Return the intersection of multiple sets (common members only)', zh: '返回多个集合的交集（共同成员）' } },
      { cmd: 'SDIFF', args: [{ name: 'keys', placeholder: 'key1 key2 …', width: 'lg', multi: true }], desc: { en: 'Return members in the first set not present in the others', zh: '返回第一个集合中有、其他集合中没有的成员' } },
      { cmd: 'SPOP', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Remove and return a random member from a set', zh: '随机移除并返回集合中的一个成员' } },
      { cmd: 'SRANDMEMBER', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Return a random member without removing it', zh: '随机返回一个成员但不删除' } },
    ],
  },
  {
    id: 'ZSet',
    label: 'ZSet',
    color: '#dcdcaa',
    cmds: [
      {
        cmd: 'ZADD',
        desc: { en: 'Add a member with a numeric score to a sorted set', zh: '向有序集合添加带分数的成员' },
        args: [
          { name: 'key', placeholder: 'key', width: 'sm' },
          { name: 'score', placeholder: '1.0', width: 'sm' },
          { name: 'member', placeholder: 'member', width: 'md' },
        ],
      },
      {
        cmd: 'ZRANGE',
        desc: { en: 'Return members ordered by rank (0 = lowest; use 0 −1 for all)', zh: '按排名返回成员（0 = 最小；0 −1 = 全部）' },
        args: [
          { name: 'key', placeholder: 'key', width: 'sm' },
          { name: 'start', placeholder: '0', type: 'number', width: 'sm' },
          { name: 'stop', placeholder: '-1', type: 'number', width: 'sm' },
        ],
      },
      {
        cmd: 'ZRANGEBYSCORE',
        desc: { en: 'Return members with scores in [min, max] (use −inf / +inf for open ranges)', zh: '返回分数在 [min, max] 范围内的成员（可用 −inf / +inf）' },
        args: [
          { name: 'key', placeholder: 'key', width: 'sm' },
          { name: 'min', placeholder: '-inf', width: 'sm' },
          { name: 'max', placeholder: '+inf', width: 'sm' },
        ],
      },
      {
        cmd: 'ZREM',
        desc: { en: 'Remove one or more members from a sorted set', zh: '从有序集合删除一个或多个成员' },
        args: [
          { name: 'key', placeholder: 'key', width: 'sm' },
          { name: 'member(s)', placeholder: 'mem1 mem2 …', width: 'md', multi: true },
        ],
      },
      {
        cmd: 'ZSCORE',
        desc: { en: 'Return the score of a member in a sorted set', zh: '返回有序集合中成员的分数' },
        args: [
          { name: 'key', placeholder: 'key', width: 'md' },
          { name: 'member', placeholder: 'member', width: 'md' },
        ],
      },
      {
        cmd: 'ZRANK',
        desc: { en: 'Return the rank of a member by ascending score (0 = lowest)', zh: '按升序分数返回成员排名（0 = 最小）' },
        args: [
          { name: 'key', placeholder: 'key', width: 'md' },
          { name: 'member', placeholder: 'member', width: 'md' },
        ],
      },
      {
        cmd: 'ZREVRANK',
        desc: { en: 'Return the rank by descending score (0 = highest)', zh: '按降序分数返回成员排名（0 = 最大）' },
        args: [
          { name: 'key', placeholder: 'key', width: 'md' },
          { name: 'member', placeholder: 'member', width: 'md' },
        ],
      },
      { cmd: 'ZCARD', args: [{ name: 'key', placeholder: 'key', width: 'md' }], desc: { en: 'Return the number of members in a sorted set', zh: '返回有序集合的成员数量' } },
      {
        cmd: 'ZINCRBY',
        desc: { en: "Increment a member's score by a delta value", zh: '将成员的分数增加指定增量' },
        args: [
          { name: 'key', placeholder: 'key', width: 'sm' },
          { name: 'by', placeholder: '1.0', width: 'sm' },
          { name: 'member', placeholder: 'member', width: 'md' },
        ],
      },
      {
        cmd: 'ZCOUNT',
        desc: { en: 'Count members with scores in [min, max]', zh: '统计分数在 [min, max] 范围内的成员数' },
        args: [
          { name: 'key', placeholder: 'key', width: 'sm' },
          { name: 'min', placeholder: '-inf', width: 'sm' },
          { name: 'max', placeholder: '+inf', width: 'sm' },
        ],
      },
    ],
  },
];

/** Wrap a single token in double quotes if it contains whitespace or quote chars. */
export function quoteArg(val: string): string {
  if (/[ \t"'\\]/.test(val)) {
    return '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  return val;
}

/** Build a Redis command string from a CmdSpec + filled-in arg values map. */
export function buildCommandString(spec: CmdSpec, argVals: Record<string, string>): string {
  const parts: string[] = [spec.cmd];
  for (const arg of spec.args) {
    const val = argVals[arg.name]?.trim() ?? '';
    if (!val) continue;
    if (arg.keyword) {
      parts.push(arg.keyword);
      parts.push(arg.multi ? val : quoteArg(val));
    } else if (arg.multi) {
      parts.push(val);
    } else {
      parts.push(quoteArg(val));
    }
  }
  return parts.join(' ');
}
