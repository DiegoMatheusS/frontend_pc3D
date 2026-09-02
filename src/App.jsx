import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import RequireAuth from './components/Layout/RequireAuth'
import RequireRole from './components/Layout/RequireRole'
import Home from './pages/Home/Home'

const Offers = lazy(() => import('./pages/Offers/Offers'))
const Community = lazy(() => import('./pages/Community/Community'))
const CommunityBuild = lazy(() => import('./pages/CommunityBuild/CommunityBuild'))
const PublishCommunity = lazy(() => import('./pages/PublishCommunity/PublishCommunity'))
const MountedPcs = lazy(() => import('./pages/MountedPcs/MountedPcs'))
const MountedPcDetails = lazy(() => import('./pages/MountedPcDetails/MountedPcDetails'))
const Store = lazy(() => import('./pages/Store/Store'))
const ProductDetails = lazy(() => import('./pages/ProductDetails/ProductDetails'))
const Notebooks = lazy(() => import('./pages/Notebooks/Notebooks'))
const NotebookDetails = lazy(() => import('./pages/NotebookDetails/NotebookDetails'))
const Login = lazy(() => import('./pages/Login/Login'))
const Register = lazy(() => import('./pages/Register/Register'))
const Account = lazy(() => import('./pages/Account/Account'))
const AccountEdit = lazy(() => import('./pages/AccountEdit/AccountEdit'))
const AffiliateOffers = lazy(() => import('./pages/AffiliateOffers/AffiliateOffers'))
const OfferSuggestion = lazy(() => import('./pages/OfferSuggestion/OfferSuggestion'))
const Institutional = lazy(() => import('./pages/Institutional/Institutional'))
const SavedBuilds = lazy(() => import('./pages/SavedBuilds/SavedBuilds'))
const SavedBuildDetails = lazy(() => import('./pages/SavedBuildDetails/SavedBuildDetails'))
const Builder = lazy(() => import('./pages/Builder/Builder'))
const NotFound = lazy(() => import('./pages/NotFound/NotFound'))

const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const AdminAccess = lazy(() => import('./admin/components/AdminAccess'))
const AdminLogin = lazy(() => import('./admin/pages/AdminLogin'))
const AdminDashboard = lazy(() => import('./admin/pages/AdminDashboard'))
const AdminProducts = lazy(() => import('./admin/pages/AdminProducts'))
const AdminProductForm = lazy(() => import('./admin/pages/AdminProductForm'))
const AdminHardwares = lazy(() => import('./admin/pages/AdminHardwares'))
const AdminHardwareDiscovery = lazy(() => import('./admin/pages/AdminHardwareDiscovery'))
const AdminHardwareForm = lazy(() => import('./admin/pages/AdminHardwareForm'))
const AdminOffers = lazy(() => import('./admin/pages/AdminOffers'))
const AdminOfferSuggestions = lazy(() => import('./admin/pages/AdminOfferSuggestions'))
const AdminOfferSuggestionDetail = lazy(() => import('./admin/pages/AdminOfferSuggestionDetail'))
const AdminOfferForm = lazy(() => import('./admin/pages/AdminOfferForm'))
const AdminPartners = lazy(() => import('./admin/pages/AdminPartners'))
const AdminModels3D = lazy(() => import('./admin/pages/AdminModels3D'))
const AdminCompatibility = lazy(() => import('./admin/pages/AdminCompatibility'))
const AdminMountPoints = lazy(() => import('./admin/pages/AdminMountPoints'))
const AdminReviews = lazy(() => import('./admin/pages/AdminReviews'))
const AdminUsers = lazy(() => import('./admin/pages/AdminUsers'))
const AdminNotebooks = lazy(() => import('./admin/pages/AdminNotebooks'))
const AdminNotebookForm = lazy(() => import('./admin/pages/AdminNotebookForm'))
const AdminMounted = lazy(() => import('./admin/pages/AdminMounted'))
const AdminMountedForm = lazy(() => import('./admin/pages/AdminMountedForm'))
const AdminAudit = lazy(() => import('./admin/pages/AdminAudit'))

function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading__spinner" aria-hidden="true" />
      <span>Carregando...</span>
    </div>
  )
}

function Lazy({ children }) {
  return <Suspense fallback={<RouteLoading />}>{children}</Suspense>
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/loja" element={<Lazy><Store /></Lazy>} />
        <Route path="/pecas" element={<Lazy><Store defaultGroup="hardwares" /></Lazy>} />
        <Route path="/produto/:id" element={<Lazy><ProductDetails /></Lazy>} />
        <Route path="/ofertas" element={<Lazy><Offers /></Lazy>} />
        <Route
          path="/enviar-oferta"
          element={(
            <RequireAuth>
              <Lazy><OfferSuggestion /></Lazy>
            </RequireAuth>
          )}
        />
        <Route path="/notebooks" element={<Lazy><Notebooks /></Lazy>} />
        <Route path="/notebooks/:id" element={<Lazy><NotebookDetails /></Lazy>} />
        <Route path="/montados" element={<Lazy><MountedPcs /></Lazy>} />
        <Route path="/montados/:id" element={<Lazy><MountedPcDetails /></Lazy>} />
        <Route path="/comunidade" element={<Lazy><Community /></Lazy>} />
        <Route
          path="/comunidade/publicar"
          element={(
            <RequireAuth>
              <Lazy><PublishCommunity /></Lazy>
            </RequireAuth>
          )}
        />
        <Route path="/comunidade/:slug" element={<Lazy><CommunityBuild /></Lazy>} />
        <Route path="/entrar" element={<Lazy><Login /></Lazy>} />
        <Route path="/cadastro" element={<Lazy><Register /></Lazy>} />
        <Route path="/sobre" element={<Lazy><Institutional page="sobre" /></Lazy>} />
        <Route path="/contato" element={<Lazy><Institutional page="contato" /></Lazy>} />
        <Route path="/privacidade" element={<Lazy><Institutional page="privacidade" /></Lazy>} />
        <Route path="/termos" element={<Lazy><Institutional page="termos" /></Lazy>} />
        <Route path="/cookies" element={<Lazy><Institutional page="cookies" /></Lazy>} />
        <Route
          path="/conta"
          element={(
            <RequireAuth>
              <Lazy><Account /></Lazy>
            </RequireAuth>
          )}
        />
        <Route
          path="/busca-ofertas"
          element={(
            <RequireRole roles={['ADMIN', 'EDITOR']}>
              <Lazy><AffiliateOffers /></Lazy>
            </RequireRole>
          )}
        />
        <Route
          path="/conta/editar"
          element={(
            <RequireAuth>
              <Lazy><AccountEdit /></Lazy>
            </RequireAuth>
          )}
        />
        <Route path="/minhas-builds" element={<Lazy><SavedBuilds /></Lazy>} />
        <Route path="/minhas-builds/:id" element={<Lazy><SavedBuildDetails /></Lazy>} />
        <Route path="/montar" element={<Lazy><Builder /></Lazy>} />
        <Route path="*" element={<Lazy><NotFound /></Lazy>} />
      </Route>

      <Route path="/admin/entrar" element={<Lazy><AdminLogin /></Lazy>} />
      <Route path="/admin" element={<Lazy><AdminLayout /></Lazy>}>
        <Route index element={<Lazy><AdminDashboard /></Lazy>} />
        <Route path="produtos" element={<Lazy><AdminProducts /></Lazy>} />
        <Route path="produtos/:id" element={<Lazy><AdminAccess roles={['ADMIN', 'EDITOR']}><AdminProductForm /></AdminAccess></Lazy>} />
        <Route path="hardwares" element={<Lazy><AdminHardwares /></Lazy>} />
        <Route path="hardwares/descobrir" element={<Lazy><AdminAccess roles={['ADMIN']}><AdminHardwareDiscovery /></AdminAccess></Lazy>} />
        <Route path="hardwares/novo" element={<Lazy><AdminAccess roles={['ADMIN']}><AdminHardwareForm /></AdminAccess></Lazy>} />
        <Route path="hardwares/:id" element={<Lazy><AdminAccess roles={['ADMIN', 'EDITOR']}><AdminHardwareForm /></AdminAccess></Lazy>} />
        <Route path="ofertas" element={<Lazy><AdminOffers /></Lazy>} />
        <Route path="sugestoes-ofertas" element={<Lazy><AdminAccess roles={['ADMIN']}><AdminOfferSuggestions /></AdminAccess></Lazy>} />
        <Route path="sugestoes-ofertas/:id" element={<Lazy><AdminAccess roles={['ADMIN']}><AdminOfferSuggestionDetail /></AdminAccess></Lazy>} />
        <Route path="ofertas/:id" element={<Lazy><AdminAccess roles={['ADMIN', 'EDITOR']}><AdminOfferForm /></AdminAccess></Lazy>} />
        <Route path="parceiros" element={<Lazy><AdminPartners /></Lazy>} />
        <Route path="modelos-3d" element={<Lazy><AdminModels3D /></Lazy>} />
        <Route path="compatibilidade" element={<Lazy><AdminCompatibility /></Lazy>} />
        <Route path="encaixes" element={<Lazy><AdminMountPoints /></Lazy>} />
        <Route path="notebooks" element={<Lazy><AdminNotebooks /></Lazy>} />
        <Route path="notebooks/:id" element={<Lazy><AdminAccess roles={['ADMIN', 'EDITOR']}><AdminNotebookForm /></AdminAccess></Lazy>} />
        <Route path="montados" element={<Lazy><AdminMounted /></Lazy>} />
        <Route path="montados/:id" element={<Lazy><AdminAccess roles={['ADMIN', 'EDITOR']}><AdminMountedForm /></AdminAccess></Lazy>} />
        <Route path="avaliacoes" element={<Lazy><AdminAccess roles={['ADMIN']}><AdminReviews /></AdminAccess></Lazy>} />
        <Route path="usuarios" element={<Lazy><AdminAccess roles={['ADMIN']}><AdminUsers /></AdminAccess></Lazy>} />
        <Route path="auditoria" element={<Lazy><AdminAccess roles={['ADMIN']}><AdminAudit /></AdminAccess></Lazy>} />
      </Route>
    </Routes>
  )
}
