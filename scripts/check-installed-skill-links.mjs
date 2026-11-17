import fs from 'node:fs';
import path from 'node:path';

const blank = (value) => value.replace(/[^\r\n]/g, ' ');
const withoutCodeBlocks = (content) => {
  let fence;
  return content.replace(/<!--[\s\S]*?-->/g, blank).split(/(?<=\n)/).map((line) => {
    const body = line.replace(/\r?\n$/, '');
    if (fence) {
      const close = body.match(/^ {0,3}(`+|~+)[ \t]*$/);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = undefined;
      return blank(line);
    }
    const open = body.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (open && (open[1][0] !== '`' || !open[2].includes('`'))) {
      fence = open[1];
      return blank(line);
    }
    return line;
  }).join('');
};
const visibleLinks = (content) => withoutCodeBlocks(content)
  .replace(/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g, blank);

const referenceKey = (label) => label.trim().replace(/\s+/gu, ' ').toLowerCase();

const linksIn = (source) => {
  const references = new Map();
  const content = visibleLinks(source).replace(
    /^ {0,3}\[([^\]\r\n]+)\]:[ \t]*(?:\r?\n[ \t]+)?(?:<([^>\r\n]*)>|([^\s]+))(?:[ \t]+(?:"[^"\r\n]*"|'[^'\r\n]*'|\([^\)\r\n]*\)))?[ \t]*\r?$/gm,
    (definition, label, enclosed, plain) => {
      const key = referenceKey(label);
      if (!references.has(key)) references.set(key, enclosed ?? plain);
      return blank(definition);
    },
  );
  const pattern = /\[([^\]\r\n]+)\](?:\((?:<([^>\r\n]*)>|([^\s)]*))(?:[ \t]+["'][^\r\n]*?["'])?\)|\[([^\]\r\n]*)\])?/g;
  return [...content.matchAll(pattern)].flatMap((match) => {
    const href = match[2] ?? match[3] ?? references.get(referenceKey(match[4] || match[1]));
    return href === undefined ? [] : [{ href, line: content.slice(0, match.index).split('\n').length }];
  });
};

const headingSlug = (heading) => heading
  .replace(/<[^>]*>/g, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
  .replace(/\s/g, '-');

const anchorsIn = (content) => {
  const text = withoutCodeBlocks(content);
  const anchors = new Set();
  const headings = new Set();
  for (const match of text.matchAll(/^ {0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$/gm)) {
    const base = headingSlug(match[1]);
    let slug = base;
    let suffix = 0;
    while (headings.has(slug)) slug = `${base}-${++suffix}`;
    headings.add(slug);
    anchors.add(slug);
  }
  for (const match of text.matchAll(/<(?:a|[a-z][\w-]*)\b[^>]*\b(?:id|name)=["']([^"']+)["'][^>]*>/gi)) {
    anchors.add(match[1]);
  }
  return anchors;
};

const markdownFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(target);
    return entry.isFile() && entry.name.endsWith('.md') ? [target] : [];
  });

/** 维护期检查安装布局；不依赖仓库根 README、个人路径或全局 Agent 配置。 */
export const checkInstalledSkillLinks = (installedRoot, skillNames, logger = console) => {
  logger.info('installed skill links: checking', { skills: skillNames.length });
  const root = path.resolve(installedRoot);
  let files;
  try {
    files = skillNames.flatMap((name) => {
      const skill = path.join(root, name);
      return fs.existsSync(skill) ? markdownFiles(skill) : [];
    });
  } catch {
    logger.error('installed skill links: FAIL', { reason: 'read_failed' });
    return false;
  }

  const issues = [];
  const anchorCache = new Map();
  try {
    for (const file of files) {
      for (const { href, line } of linksIn(fs.readFileSync(file, 'utf8'))) {
        const location = `${path.relative(root, file)}:${line}`;
        const issue = (reason) => issues.push({ location, target: href, reason });
        if (/^file:/i.test(href)) {
          issue('non_portable_file_url');
          continue;
        }
        if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) continue;
        let resource;
        let anchor;
        try {
          const [pathname, fragment = ''] = href.split('#', 2);
          resource = decodeURIComponent(pathname.split('?', 1)[0]);
          anchor = decodeURIComponent(fragment);
        } catch {
          issue('invalid_link_encoding');
          continue;
        }
        const target = resource ? path.resolve(path.dirname(file), resource) : file;
        const relative = path.relative(root, target);
        if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
          issue('outside_skills_root');
        } else if (!fs.existsSync(target)) {
          issue('missing_link_target');
        } else if (anchor && target.endsWith('.md')) {
          if (!anchorCache.has(target)) anchorCache.set(target, anchorsIn(fs.readFileSync(target, 'utf8')));
          if (!anchorCache.get(target).has(anchor)) issue('missing_link_anchor');
        }
      }
    }
  } catch {
    logger.error('installed skill links: FAIL', { reason: 'read_failed' });
    return false;
  }

  for (const issue of issues) logger.error('installed skill link: FAIL', issue);
  logger.info(`installed skill links: ${issues.length ? 'FAIL' : 'PASS'}`, {
    documents: files.length, issues: issues.length,
  });
  return issues.length === 0;
};
