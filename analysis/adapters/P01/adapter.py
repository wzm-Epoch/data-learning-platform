"""Read-only project entry; run from the project root."""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from phase4 import build
if __name__=="__main__":build(["C"],only="P01")
