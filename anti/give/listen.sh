while true; do
  inotifywait -qq -e CLOSE_WRITE pages/
  python compile.py
done
