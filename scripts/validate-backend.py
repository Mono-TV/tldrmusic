#!/usr/bin/env python3
"""
Backend Validation Script for TLDR Music

Validates:
1. Python syntax for all backend files
2. Pydantic models are valid and consistent
3. No model field mismatches in service code

Run this before deploying to catch model/function mismatches.
"""

import sys
import os
import ast

# Project root
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_SRC = os.path.join(PROJECT_ROOT, 'backend', 'src')


def check_python_syntax(filepath):
    """Check Python file syntax"""
    try:
        with open(filepath, 'r') as f:
            source = f.read()
        ast.parse(source)
        return None
    except SyntaxError as e:
        return f"Line {e.lineno}: {e.msg}"


def extract_model_fields(filepath, model_name):
    """Extract fields from a Pydantic model in a file"""
    try:
        with open(filepath, 'r') as f:
            source = f.read()

        tree = ast.parse(source)

        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef) and node.name == model_name:
                fields = {}
                for item in node.body:
                    if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                        field_name = item.target.id
                        # Check if it has a default value
                        has_default = item.value is not None
                        fields[field_name] = {'required': not has_default}
                return fields

        return None
    except Exception as e:
        return None


def find_model_instantiations(filepath, model_name):
    """Find where a model is instantiated and what fields are passed (using AST)"""
    try:
        with open(filepath, 'r') as f:
            source = f.read()

        tree = ast.parse(source)
        instantiations = []

        for node in ast.walk(tree):
            # Look for Call nodes where the function is our model name
            if isinstance(node, ast.Call):
                # Check if this is a call to our model
                func = node.func
                func_name = None

                if isinstance(func, ast.Name):
                    func_name = func.id
                elif isinstance(func, ast.Attribute):
                    func_name = func.attr

                if func_name == model_name:
                    # Extract keyword argument names
                    fields = set()
                    uses_kwargs = False

                    for keyword in node.keywords:
                        if keyword.arg is None:
                            # This is **kwargs unpacking, skip validation
                            uses_kwargs = True
                            break
                        fields.add(keyword.arg)

                    # Skip if uses **kwargs (can't validate statically)
                    if not uses_kwargs:
                        instantiations.append(fields)

        return instantiations
    except Exception:
        return []


def validate_model_usage(model_file, model_name, service_files):
    """Check that service files use correct model fields"""
    errors = []

    # Get model fields
    model_fields = extract_model_fields(model_file, model_name)
    if model_fields is None:
        return [f"Could not find {model_name} in {model_file}"]

    model_field_names = set(model_fields.keys())
    required_fields = {name for name, info in model_fields.items() if info['required']}

    # Check each service file
    for service_file in service_files:
        if not os.path.exists(service_file):
            continue

        instantiations = find_model_instantiations(service_file, model_name)

        for i, used_fields in enumerate(instantiations):
            # Check for fields that don't exist in the model
            invalid_fields = used_fields - model_field_names
            if invalid_fields:
                rel_path = os.path.relpath(service_file, PROJECT_ROOT)
                errors.append(f"{rel_path}: {model_name} uses invalid fields: {invalid_fields}")

            # Check for missing required fields
            missing_required = required_fields - used_fields
            if missing_required:
                rel_path = os.path.relpath(service_file, PROJECT_ROOT)
                errors.append(f"{rel_path}: {model_name} missing required fields: {missing_required}")

    return errors


def main():
    print("\n" + "="*50)
    print("  TLDR Music - Backend Validation")
    print("="*50 + "\n")

    all_errors = []

    # ============================================================
    # Check 1: Python syntax for all backend files
    # ============================================================
    print("▸ Checking Python syntax...")

    for root, dirs, files in os.walk(BACKEND_SRC):
        # Skip __pycache__ directories
        dirs[:] = [d for d in dirs if d != '__pycache__']

        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                rel_path = os.path.relpath(filepath, PROJECT_ROOT)
                error = check_python_syntax(filepath)
                if error:
                    all_errors.append(f"Syntax error in {rel_path}: {error}")
                    print(f"  ✗ {rel_path}: {error}")
                else:
                    print(f"  ✓ {rel_path}")

    # ============================================================
    # Check 2: Pydantic model field consistency
    # ============================================================
    print("\n▸ Checking model-service alignment...")

    library_model_file = os.path.join(BACKEND_SRC, 'models', 'library.py')
    service_files = [
        os.path.join(BACKEND_SRC, 'services', 'library.py'),
        os.path.join(BACKEND_SRC, 'api', 'routes', 'library.py'),
    ]

    # Check PlaylistSummary usage
    if os.path.exists(library_model_file):
        model_fields = extract_model_fields(library_model_file, 'PlaylistSummary')
        if model_fields:
            print(f"  PlaylistSummary fields: {set(model_fields.keys())}")
            required = {k for k, v in model_fields.items() if v['required']}
            print(f"  PlaylistSummary required: {required}")

        errors = validate_model_usage(library_model_file, 'PlaylistSummary', service_files)
        if errors:
            all_errors.extend(errors)
            for error in errors:
                print(f"  ✗ {error}")
        else:
            print("  ✓ PlaylistSummary usage OK")

        # Check Playlist usage
        errors = validate_model_usage(library_model_file, 'Playlist', service_files)
        if errors:
            all_errors.extend(errors)
            for error in errors:
                print(f"  ✗ {error}")
        else:
            print("  ✓ Playlist usage OK")

        # Check FavoriteEntry usage
        errors = validate_model_usage(library_model_file, 'FavoriteEntry', service_files)
        if errors:
            all_errors.extend(errors)
            for error in errors:
                print(f"  ✗ {error}")
        else:
            print("  ✓ FavoriteEntry usage OK")

    else:
        print(f"  ⚠ Model file not found: {library_model_file}")

    # ============================================================
    # Summary
    # ============================================================
    print("\n" + "="*50)

    if all_errors:
        print(f"  ✗ FAILED - {len(all_errors)} error(s) found")
        print("="*50 + "\n")
        print("Errors:")
        for error in all_errors:
            print(f"  - {error}")
        print("")
        return 1
    else:
        print("  ✓ All backend validations passed!")
        print("="*50 + "\n")
        return 0


if __name__ == "__main__":
    sys.exit(main())
