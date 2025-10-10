interface AboutAppModalProps {
  isOpen: boolean
  onClose: () => void
}

export const AboutAppModal = ({ isOpen, onClose }: AboutAppModalProps) => {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal modal--info" role="dialog" aria-modal="true" aria-labelledby="about-modal-title">
        <h2 id="about-modal-title">¿Qué es Simple Alquiler?</h2>
        <p>
          Gestiona tus alojamientos turísticos desde un panel pensado para anfitriones: sincronización con Airbnb, bloqueos manuales
          y un enlace público para recibir reservas sin exponer tu panel administrativo.
        </p>
        <p>
          Escríbenos a{' '}
          <a href="mailto:hola@simplealquiler.net">hola@simplealquiler.net</a> o contáctanos por{' '}
          <a href="https://wa.me/5492364261382" target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          .
        </p>
        <button type="button" className="primary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  )
}
