echo "polymer build..."
polymer build &&

echo "copying to docs/..."
cp -rf build/bundled/ docs/ &&

echo "create CNAME file..."
echo "komoscope.com" > docs/CNAME &&

git stash
git add docs/ &&
git commit -m "github pages deploy build" && # TODO: build number?

echo "publish to github pages..."
git push origin master

git stash apply

#TODO: print deploy status messages to stdout
