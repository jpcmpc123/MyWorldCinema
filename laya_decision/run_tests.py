import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + "/.."))

def main():
    print("=" * 70)
    print("EXECUTANDO TESTES DO LAYA DECISION (UNITÁRIOS + REAIS)")
    print("=" * 70)

    loader = unittest.TestLoader()
    test_dir = os.path.join(os.path.dirname(__file__), "tests")
    suite = loader.discover(start_dir=test_dir, pattern="test_*.py")

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("\n" + "=" * 70)
    if result.wasSuccessful():
        print(f"TODOS OS TESTES PASSARAM COM SUCESSO! ({result.testsRun} testes executados)")
        print("=" * 70)
        sys.exit(0)
    else:
        print(f"FALHA NOS TESTES: {len(result.failures)} falhas, {len(result.errors)} erros.")
        print("=" * 70)
        sys.exit(1)

if __name__ == "__main__":
    main()
