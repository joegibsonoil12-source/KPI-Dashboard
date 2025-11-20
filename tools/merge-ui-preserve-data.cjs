/**
 * tools/merge-ui-preserve-data.js
 *
 * Usage:
 *   npm install @babel/parser @babel/traverse @babel/generator @babel/types
 *   node tools/merge-ui-preserve-data.js /tmp/old_ExecutiveDashboard.jsx src/components/dashboard/ExecutiveDashboard.jsx
 */

const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error('Usage: node tools/merge-ui-preserve-data.js <old-file> <current-file>');
    process.exit(1);
  }

  const [oldFilePath, currentFilePath] = args;

  // Read files
  const oldCode = fs.readFileSync(oldFilePath, 'utf8');
  const currentCode = fs.readFileSync(currentFilePath, 'utf8');

  // Parse both files
  const oldAst = parser.parse(oldCode, {
    sourceType: 'module',
    plugins: ['jsx']
  });

  const currentAst = parser.parse(currentCode, {
    sourceType: 'module',
    plugins: ['jsx']
  });

  // Extract the return statement from the old file's main component
  let oldReturnStatement = null;
  
  traverse(oldAst, {
    ExportDefaultDeclaration(path) {
      const declaration = path.node.declaration;
      if (t.isFunctionDeclaration(declaration)) {
        // Found the default exported function
        traverse(declaration, {
          ReturnStatement(returnPath) {
            if (!oldReturnStatement) {
              oldReturnStatement = t.cloneNode(returnPath.node, true);
            }
            returnPath.stop();
          }
        }, path.scope, path);
      }
    },
    // Also handle if it's exported as a variable/const
    ExportNamedDeclaration(path) {
      if (path.node.declaration && t.isVariableDeclaration(path.node.declaration)) {
        const declarations = path.node.declaration.declarations;
        for (const decl of declarations) {
          if (t.isFunctionExpression(decl.init) || t.isArrowFunctionExpression(decl.init)) {
            traverse(decl.init, {
              ReturnStatement(returnPath) {
                if (!oldReturnStatement) {
                  oldReturnStatement = t.cloneNode(returnPath.node, true);
                }
                returnPath.stop();
              }
            }, path.scope, path);
          }
        }
      }
    }
  });

  if (!oldReturnStatement) {
    console.error('ERROR: Could not find return statement in old file');
    process.exit(1);
  }

  // Replace the return statement in the current file's main component
  let replaced = false;

  traverse(currentAst, {
    ExportDefaultDeclaration(path) {
      const declaration = path.node.declaration;
      if (t.isFunctionDeclaration(declaration)) {
        // Found the default exported function
        traverse(declaration, {
          ReturnStatement(returnPath) {
            if (!replaced) {
              returnPath.replaceWith(oldReturnStatement);
              replaced = true;
            }
            returnPath.stop();
          }
        }, path.scope, path);
      }
    }
  });

  if (!replaced) {
    console.error('ERROR: Could not find and replace return statement in current file');
    process.exit(1);
  }

  // Generate the merged code
  const output = generate(currentAst, {
    retainLines: false,
    comments: true
  }, currentCode);

  // Write to stdout
  console.log(output.code);
}

main();
