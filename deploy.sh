git diff-index --quiet HEAD --
status=$?

if [ $status -eq 1 ]; then
    echo "ABORT: working directory is dirty"
    exit 1
fi

echo "polymer build..."
polymer build &&

echo "copying to docs/..."
cp -rf build/bundled/ docs/ &&

echo "create docs/CNAME file..."
echo "komoscope.com" > docs/CNAME &&

git add docs/ &&
git commit -m "github pages deploy build" && # TODO: build number?

echo "publish to github pages..."
git push &&

exit 0
