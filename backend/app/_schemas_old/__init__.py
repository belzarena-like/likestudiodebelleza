# Import all schemas from the main schemas module
# Also import payment and QR schemas from their modules
try:
    from ..schemas import *
except ImportError:
    # If the main schemas module can't be imported, at least import payment and QR schemas
    pass

from .payments import *
from .qr import *